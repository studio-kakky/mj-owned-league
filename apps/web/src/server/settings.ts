/**
 * TanStack Start server functions for the S16 Settings screen
 * (`04-screens.md` § S16, Issue #17).
 *
 * Shape & boundaries — mirrors `server/groups.ts` (Issue #15) and
 * `server/dashboard.ts` (Issue #14):
 *   - Handlers are exported separately from the `createServerFn` wrappers so
 *     unit tests can drive them without bundling the RPC compiler.
 *   - The route layer is the only place that crosses the RPC boundary; the
 *     `SettingsScreen` component never imports anything from this file.
 *   - The handlers share the same in-memory store as `groups.ts` and
 *     `dashboard.ts` so write-throughs are visible across screens within a
 *     single dev session. When the D1 binding becomes reachable from a
 *     server function (#39) the `makeRepos` factory below is the only thing
 *     that needs to change.
 *
 * Group scoping (Issue #62):
 *   `getSettings` requires a `groupId` — it always comes from the URL path
 *   (`/groups/:groupId/settings`). There is no cross-Group fallback: the
 *   "first owned Group" default and the optional `?groupId=` query that used
 *   to live here are both gone. A foreign / unknown id resolves to `null`
 *   (the route redirects to `/groups`, the selection screen). All mutation
 *   handlers cross-check that the target Ruleset / Player belongs to a Group
 *   owned by the caller via {@link assertGroupOwnedBy}, so ownership is the
 *   server's responsibility even though the UI only links to the Owner's own
 *   Groups.
 *
 * `hasGameHistory` for Players:
 *   The interim in-memory store does not yet model GameResult rows (Game is
 *   present, GameResult is not). `MemoryPlayerRepository.hasGameHistory`
 *   therefore returns `false` for every Player. The history-aware delete
 *   path still works end-to-end: the service throws `PlayerHasHistoryError`
 *   whenever the repo returns `true`, the server function rethrows a
 *   serialisable shape, and the modal flips to "非アクティブ化" mode. Once
 *   GameResult lands (with #39 D1 work), only this repository needs to be
 *   updated.
 */

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type {
  SettingsData,
  SettingsGroupSummary,
  SettingsPlayerItem,
  SettingsRulesetItem,
} from '../components/settings';
import type { Database } from '../db/client';
import type { Group, NewPlayer, NewRuleset, Ruleset } from '../db/schema';
import { UMA_PATTERNS } from '../db/schema';
import {
  DrizzleGroupRepository,
  DrizzlePlayerRepository,
  DrizzleRulesetRepository,
} from '../repositories/drizzle';
import type {
  GroupRepository,
  PlayerRepository,
  RulesetRepository,
} from '../repositories/interfaces';
import { PlayerHasHistoryError } from '../services/errors';
import { PlayerService } from '../services/player-service';
import { RulesetService, TobiConfigurationError } from '../services/ruleset-service';
import { getRequestDb, requireOwnerId } from './context';
import { getGroupServerStore, seedDevDataIfEmpty } from './groups-store';
import {
  MemoryGroupRepository,
  MemoryPlayerRepository,
  MemoryRulesetRepository,
} from './memory-repos';

// ---------------------------------------------------------------------------
// Repository facade — identical shape to `groups.ts`. We construct fresh
// service instances per call so they pick up the latest store state.
//
// Two backings (Issue #39): pass the request's Drizzle `db` for the D1 path
// (production), or nothing for the in-memory path the unit tests drive. All
// Group ownership checks go through the `groups` repository so the same
// handler logic works against either backing.
// ---------------------------------------------------------------------------

interface ServerRepos {
  groups: GroupRepository;
  rulesetService: RulesetService;
  playerService: PlayerService;
  rulesets: RulesetRepository;
  players: PlayerRepository;
}

const makeRepos = (db?: Database): ServerRepos => {
  const { groups, rulesets, players } = db
    ? {
        groups: new DrizzleGroupRepository(db),
        rulesets: new DrizzleRulesetRepository(db),
        players: new DrizzlePlayerRepository(db),
      }
    : (() => {
        const store = getGroupServerStore();
        return {
          groups: new MemoryGroupRepository(store),
          rulesets: new MemoryRulesetRepository(store),
          players: new MemoryPlayerRepository(store),
        };
      })();
  return {
    groups,
    rulesets,
    players,
    rulesetService: new RulesetService(rulesets),
    playerService: new PlayerService(players),
  };
};

// ---------------------------------------------------------------------------
// Input validators
// ---------------------------------------------------------------------------

// Client-facing validators. `ownerId` is resolved server-side from the session
// (`requireOwnerId()`), so it never appears in the wire payload. The handler
// input types add `ownerId` back because the handlers — the testable seam —
// still take it explicitly.
const settingsInput = z.object({
  /**
   * The Group whose Settings to load. Required — it always comes from the
   * URL path at `/groups/:groupId/settings`, so there is no cross-Group
   * fallback. A foreign / unknown id resolves to `null` (the route
   * redirects to `/groups`).
   */
  groupId: z.string().min(1),
});

const rulesetFormSchema = z.object({
  name: z.string().trim().min(1).max(60),
  startingScore: z.number().int().positive(),
  returnScore: z.number().int().positive(),
  umaPattern: z.enum(UMA_PATTERNS),
  tobiEnabled: z.boolean(),
  tobiPoint: z.number().nullable(),
});

const createRulesetInput = z.object({
  groupId: z.string().min(1),
  input: rulesetFormSchema,
});

const updateRulesetInput = z.object({
  rulesetId: z.string().min(1),
  input: rulesetFormSchema,
});

const deleteRulesetInput = z.object({
  rulesetId: z.string().min(1),
});

const setDefaultRulesetInput = z.object({
  rulesetId: z.string().min(1),
});

const createPlayerInput = z.object({
  groupId: z.string().min(1),
  name: z.string().trim().min(1).max(40),
});

const renamePlayerInput = z.object({
  playerId: z.string().min(1),
  name: z.string().trim().min(1).max(40),
});

const playerIdInput = z.object({
  playerId: z.string().min(1),
});

type WithOwner<T> = T & { ownerId: string };

export type SettingsInput = WithOwner<z.infer<typeof settingsInput>>;
export type CreateRulesetServerInput = WithOwner<z.infer<typeof createRulesetInput>>;
export type UpdateRulesetServerInput = WithOwner<z.infer<typeof updateRulesetInput>>;
export type DeleteRulesetServerInput = WithOwner<z.infer<typeof deleteRulesetInput>>;
export type SetDefaultRulesetServerInput = WithOwner<z.infer<typeof setDefaultRulesetInput>>;
export type CreatePlayerServerInput = WithOwner<z.infer<typeof createPlayerInput>>;
export type RenamePlayerServerInput = WithOwner<z.infer<typeof renamePlayerInput>>;
export type PlayerIdServerInput = WithOwner<z.infer<typeof playerIdInput>>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const projectRuleset = (
  ruleset: Ruleset,
  groupDefaultRulesetId: string | null,
): SettingsRulesetItem => {
  return {
    id: ruleset.id,
    name: ruleset.name,
    startingScore: ruleset.startingScore,
    returnScore: ruleset.returnScore,
    umaPattern: ruleset.umaPattern,
    tobiEnabled: ruleset.tobiEnabled,
    tobiPoint: ruleset.tobiPoint,
    isDefault: groupDefaultRulesetId === ruleset.id,
  };
};

/**
 * Verifies that `groupId` exists and is owned by `ownerId`. Throws a generic
 * `Error` otherwise — this is the security boundary for every mutation on
 * this screen; we never surface a more granular reason because the only
 * legitimate caller (the route's loader-fed UI) cannot land here with a
 * mismatched id.
 */
const assertGroupOwnedBy = async (
  groups: GroupRepository,
  groupId: string,
  ownerId: string,
): Promise<Group> => {
  const group = await groups.findById(groupId);
  if (!group || group.ownerId !== ownerId) {
    throw new Error('Group not found or not owned by caller.');
  }
  return group;
};

/**
 * Translates known domain errors into serialisable `Error` shapes so the
 * client can render the message verbatim. Currently covers
 * `TobiConfigurationError`; unknown causes bubble up untouched.
 */
const rethrowDomainError = (cause: unknown): never => {
  if (cause instanceof TobiConfigurationError) {
    throw new Error(cause.message);
  }
  throw cause;
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Builds the {@link SettingsData} payload for one Group
 * (`/groups/:groupId/settings`, Issue #62).
 *
 * The `groupId` is required and comes from the URL path; there is no
 * cross-Group fallback. Returns `null` when the Group does not exist or is
 * owned by a different Owner — the route surfaces that as a redirect to
 * `/groups`. Ownership is the server's responsibility: we never trust the
 * path `groupId` on the wire even though the UI only links to the Owner's own
 * Groups.
 *
 * Step-by-step:
 *   1. Materialise the dev seed (shared with /groups and /).
 *   2. Resolve + ownership-check the requested Group; bail with `null` on a
 *      foreign / unknown id.
 *   3. List the Group's Rulesets and Players via the repository interfaces,
 *      then project each into the screen's shape.
 */
export const getSettingsHandler = async (
  input: SettingsInput,
  db?: Database,
): Promise<SettingsData | null> => {
  if (!db) seedDevDataIfEmpty(input.ownerId);

  const { groups, rulesets, players } = makeRepos(db);

  // Ownership guard: the Group must exist and belong to the caller. A foreign
  // / unknown id resolves to `null` (the route redirects to `/groups`).
  const active = await groups.findById(input.groupId);
  if (active === null || active.ownerId !== input.ownerId) return null;

  const groupSummary: SettingsGroupSummary = {
    id: active.id,
    name: active.name,
    defaultRulesetId: active.defaultRulesetId,
  };

  const [rulesetRows, playerRows] = await Promise.all([
    rulesets.listByGroup(active.id),
    players.listByGroup(active.id),
  ]);

  // Player projection: surface `hasGameHistory` so the UI can pre-flight the
  // delete vs. deactivate decision without a second round trip. Today this
  // is always `false` from the in-memory repo (see file-level comment).
  const playerItems: SettingsPlayerItem[] = await Promise.all(
    playerRows.map(async (player): Promise<SettingsPlayerItem> => {
      const hasHistory = await players.hasGameHistory(player.id);
      return {
        id: player.id,
        name: player.name,
        isActive: player.isActive,
        hasHistory,
      };
    }),
  );

  // Sort active players first, then by createdAt ascending so newly added
  // entries land at the bottom of the list. Active vs. inactive split makes
  // the "current roster" obvious at a glance.
  playerItems.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return 0;
  });

  const rulesetItems: SettingsRulesetItem[] = rulesetRows.map(
    (ruleset): SettingsRulesetItem => projectRuleset(ruleset, active.defaultRulesetId),
  );

  return {
    group: groupSummary,
    rulesets: rulesetItems,
    players: playerItems,
  };
};

export const createRulesetHandler = async (
  input: CreateRulesetServerInput,
  db?: Database,
): Promise<SettingsRulesetItem> => {
  const { groups, rulesetService } = makeRepos(db);
  const group = await assertGroupOwnedBy(groups, input.groupId, input.ownerId);

  const newRow: NewRuleset = {
    id: globalThis.crypto.randomUUID(),
    groupId: input.groupId,
    ...input.input,
  };
  try {
    const ruleset = await rulesetService.create(newRow);
    return projectRuleset(ruleset, group.defaultRulesetId ?? null);
  } catch (cause) {
    throw rethrowDomainError(cause);
  }
};

export const updateRulesetHandler = async (
  input: UpdateRulesetServerInput,
  db?: Database,
): Promise<SettingsRulesetItem | null> => {
  const { groups, rulesetService, rulesets } = makeRepos(db);
  const existing = await rulesets.findById(input.rulesetId);
  if (existing === null) return null;
  await assertGroupOwnedBy(groups, existing.groupId, input.ownerId);

  try {
    const updated = await rulesetService.update(input.rulesetId, input.input);
    if (updated === null) return null;
    const group = await groups.findById(updated.groupId);
    return projectRuleset(updated, group?.defaultRulesetId ?? null);
  } catch (cause) {
    throw rethrowDomainError(cause);
  }
};

export const deleteRulesetHandler = async (
  input: DeleteRulesetServerInput,
  db?: Database,
): Promise<{ deleted: boolean }> => {
  const { groups, rulesetService, rulesets } = makeRepos(db);
  const existing = await rulesets.findById(input.rulesetId);
  if (existing === null) return { deleted: false };
  const group = await assertGroupOwnedBy(groups, existing.groupId, input.ownerId);

  // Refuse to delete the Group's current default Ruleset — the schema would
  // null it out silently otherwise. The UI also disables the affordance, but
  // we re-check here to close the TOCTOU window.
  if (group.defaultRulesetId === existing.id) {
    throw new Error(
      'Ruleset is set as the group default; pick another default first before deleting.',
    );
  }

  const deleted = await rulesetService.delete(input.rulesetId);
  return { deleted };
};

export const setDefaultRulesetHandler = async (
  input: SetDefaultRulesetServerInput,
  db?: Database,
): Promise<{ ok: boolean }> => {
  const { groups, rulesets } = makeRepos(db);
  const existing = await rulesets.findById(input.rulesetId);
  if (existing === null) return { ok: false };
  const group = await assertGroupOwnedBy(groups, existing.groupId, input.ownerId);

  const updated = await groups.update(group.id, { defaultRulesetId: existing.id });
  return { ok: updated !== null };
};

export const createPlayerHandler = async (
  input: CreatePlayerServerInput,
  db?: Database,
): Promise<SettingsPlayerItem> => {
  const { groups, playerService } = makeRepos(db);
  await assertGroupOwnedBy(groups, input.groupId, input.ownerId);

  const newRow: NewPlayer = {
    id: globalThis.crypto.randomUUID(),
    groupId: input.groupId,
    name: input.name,
    isActive: true,
  };
  const player = await playerService.create(newRow);
  // New players have no history by definition.
  return { id: player.id, name: player.name, isActive: player.isActive, hasHistory: false };
};

export const renamePlayerHandler = async (
  input: RenamePlayerServerInput,
  db?: Database,
): Promise<SettingsPlayerItem | null> => {
  const { groups, playerService, players } = makeRepos(db);
  const existing = await players.findById(input.playerId);
  if (existing === null) return null;
  await assertGroupOwnedBy(groups, existing.groupId, input.ownerId);

  const updated = await playerService.update(input.playerId, { name: input.name });
  if (updated === null) return null;
  const hasHistory = await players.hasGameHistory(updated.id);
  return { id: updated.id, name: updated.name, isActive: updated.isActive, hasHistory };
};

export const deletePlayerHandler = async (
  input: PlayerIdServerInput,
  db?: Database,
): Promise<{ deleted: boolean }> => {
  const { groups, playerService, players } = makeRepos(db);
  const existing = await players.findById(input.playerId);
  if (existing === null) return { deleted: false };
  await assertGroupOwnedBy(groups, existing.groupId, input.ownerId);

  try {
    const deleted = await playerService.delete(input.playerId);
    return { deleted };
  } catch (cause) {
    if (cause instanceof PlayerHasHistoryError) {
      throw new Error(`Player ${input.playerId} has game history; deactivate instead of deleting.`);
    }
    throw cause;
  }
};

export const deactivatePlayerHandler = async (
  input: PlayerIdServerInput,
  db?: Database,
): Promise<SettingsPlayerItem | null> => {
  const { groups, playerService, players } = makeRepos(db);
  const existing = await players.findById(input.playerId);
  if (existing === null) return null;
  await assertGroupOwnedBy(groups, existing.groupId, input.ownerId);

  const updated = await playerService.deactivate(input.playerId);
  if (updated === null) return null;
  const hasHistory = await players.hasGameHistory(updated.id);
  return { id: updated.id, name: updated.name, isActive: updated.isActive, hasHistory };
};

export const reactivatePlayerHandler = async (
  input: PlayerIdServerInput,
  db?: Database,
): Promise<SettingsPlayerItem | null> => {
  const { groups, playerService, players } = makeRepos(db);
  const existing = await players.findById(input.playerId);
  if (existing === null) return null;
  await assertGroupOwnedBy(groups, existing.groupId, input.ownerId);

  const updated = await playerService.reactivate(input.playerId);
  if (updated === null) return null;
  const hasHistory = await players.hasGameHistory(updated.id);
  return { id: updated.id, name: updated.name, isActive: updated.isActive, hasHistory };
};

// ---------------------------------------------------------------------------
// Server function wrappers
// ---------------------------------------------------------------------------

export const getSettingsServerFn = createServerFn({ method: 'GET' })
  .inputValidator(settingsInput)
  .handler(async ({ data }) =>
    getSettingsHandler({ ...data, ownerId: await requireOwnerId() }, getRequestDb()),
  );

export const createRulesetServerFn = createServerFn({ method: 'POST' })
  .inputValidator(createRulesetInput)
  .handler(async ({ data }) =>
    createRulesetHandler({ ...data, ownerId: await requireOwnerId() }, getRequestDb()),
  );

export const updateRulesetServerFn = createServerFn({ method: 'POST' })
  .inputValidator(updateRulesetInput)
  .handler(async ({ data }) =>
    updateRulesetHandler({ ...data, ownerId: await requireOwnerId() }, getRequestDb()),
  );

export const deleteRulesetServerFn = createServerFn({ method: 'POST' })
  .inputValidator(deleteRulesetInput)
  .handler(async ({ data }) =>
    deleteRulesetHandler({ ...data, ownerId: await requireOwnerId() }, getRequestDb()),
  );

export const setDefaultRulesetServerFn = createServerFn({ method: 'POST' })
  .inputValidator(setDefaultRulesetInput)
  .handler(async ({ data }) =>
    setDefaultRulesetHandler({ ...data, ownerId: await requireOwnerId() }, getRequestDb()),
  );

export const createPlayerServerFn = createServerFn({ method: 'POST' })
  .inputValidator(createPlayerInput)
  .handler(async ({ data }) =>
    createPlayerHandler({ ...data, ownerId: await requireOwnerId() }, getRequestDb()),
  );

export const renamePlayerServerFn = createServerFn({ method: 'POST' })
  .inputValidator(renamePlayerInput)
  .handler(async ({ data }) =>
    renamePlayerHandler({ ...data, ownerId: await requireOwnerId() }, getRequestDb()),
  );

export const deletePlayerServerFn = createServerFn({ method: 'POST' })
  .inputValidator(playerIdInput)
  .handler(async ({ data }) =>
    deletePlayerHandler({ ...data, ownerId: await requireOwnerId() }, getRequestDb()),
  );

export const deactivatePlayerServerFn = createServerFn({ method: 'POST' })
  .inputValidator(playerIdInput)
  .handler(async ({ data }) =>
    deactivatePlayerHandler({ ...data, ownerId: await requireOwnerId() }, getRequestDb()),
  );

export const reactivatePlayerServerFn = createServerFn({ method: 'POST' })
  .inputValidator(playerIdInput)
  .handler(async ({ data }) =>
    reactivatePlayerHandler({ ...data, ownerId: await requireOwnerId() }, getRequestDb()),
  );
