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
 * Active-group resolution:
 *   `getSettings` accepts only `ownerId` from the client. The server picks
 *   the Owner's most-recently-created Group (deterministic ordering on
 *   `createdAt`) as the active Group. This is a deliberate interim choice —
 *   the GroupSwitcher (Issue #11) does not yet feed an `activeGroupId` into
 *   any route loader. When that wiring lands, the client will start passing
 *   `activeGroupId` and the server will fall back to the owner's first group
 *   only when none is supplied. All mutation handlers cross-check that the
 *   target Ruleset / Player belongs to a Group owned by the caller, so the
 *   "first group" choice is purely about defaulting; it never grants extra
 *   access.
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
import type { Group, NewPlayer, NewRuleset, Player, Ruleset } from '../db/schema';
import { UMA_PATTERNS } from '../db/schema';
import type { PlayerRepository, RulesetRepository } from '../repositories/interfaces';
import { PlayerHasHistoryError } from '../services/errors';
import { PlayerService } from '../services/player-service';
import { RulesetService, TobiConfigurationError } from '../services/ruleset-service';
import {
  type GroupServerStore,
  getGroupServerStore,
  type InMemoryStoreShape,
  seedDevDataIfEmpty,
} from './groups-store';

// ---------------------------------------------------------------------------
// Repository facade — identical shape to `groups.ts`. We construct fresh
// service instances per call so they pick up the latest store state.
// ---------------------------------------------------------------------------

interface ServerRepos {
  store: GroupServerStore;
  rulesetService: RulesetService;
  playerService: PlayerService;
  rulesets: RulesetRepository;
  players: PlayerRepository;
}

function makeRepos(): ServerRepos {
  const store = getGroupServerStore();
  const rulesets = new MemoryRulesetRepository(store);
  const players = new MemoryPlayerRepository(store);
  return {
    store,
    rulesets,
    players,
    rulesetService: new RulesetService(rulesets),
    playerService: new PlayerService(players),
  };
}

// ---------------------------------------------------------------------------
// Input validators
// ---------------------------------------------------------------------------

const settingsInput = z.object({
  ownerId: z.string().min(1),
  /**
   * Optional Group selector. When supplied (and owned by the caller), the
   * loader builds the Settings payload for that Group instead of the
   * Owner's first Group. Foreign / unknown ids silently fall through to
   * the default selection — same convention as the other list handlers.
   *
   * Surfaced so screens like S6 Group 詳細 can deep-link to the matching
   * Group's Settings via `/settings?groupId=…`. Once the GroupSwitcher
   * (Issue #11) exposes the active group through the layout we can promote
   * this to the canonical input.
   */
  groupId: z.string().min(1).optional(),
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
  ownerId: z.string().min(1),
  groupId: z.string().min(1),
  input: rulesetFormSchema,
});

const updateRulesetInput = z.object({
  ownerId: z.string().min(1),
  rulesetId: z.string().min(1),
  input: rulesetFormSchema,
});

const deleteRulesetInput = z.object({
  ownerId: z.string().min(1),
  rulesetId: z.string().min(1),
});

const setDefaultRulesetInput = z.object({
  ownerId: z.string().min(1),
  rulesetId: z.string().min(1),
});

const createPlayerInput = z.object({
  ownerId: z.string().min(1),
  groupId: z.string().min(1),
  name: z.string().trim().min(1).max(40),
});

const renamePlayerInput = z.object({
  ownerId: z.string().min(1),
  playerId: z.string().min(1),
  name: z.string().trim().min(1).max(40),
});

const playerIdInput = z.object({
  ownerId: z.string().min(1),
  playerId: z.string().min(1),
});

export type SettingsInput = z.infer<typeof settingsInput>;
export type CreateRulesetServerInput = z.infer<typeof createRulesetInput>;
export type UpdateRulesetServerInput = z.infer<typeof updateRulesetInput>;
export type DeleteRulesetServerInput = z.infer<typeof deleteRulesetInput>;
export type SetDefaultRulesetServerInput = z.infer<typeof setDefaultRulesetInput>;
export type CreatePlayerServerInput = z.infer<typeof createPlayerInput>;
export type RenamePlayerServerInput = z.infer<typeof renamePlayerInput>;
export type PlayerIdServerInput = z.infer<typeof playerIdInput>;

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Builds the {@link SettingsData} payload for a single Owner.
 *
 * Step-by-step:
 *   1. Materialise the dev seed (shared with /groups and /).
 *   2. Pick the Owner's first Group (createdAt ascending) as active. Surface
 *      `group: null` when the Owner has none.
 *   3. List the active Group's Rulesets and Players via the repository
 *      interfaces, then project each into the screen's shape.
 */
export async function getSettingsHandler(input: SettingsInput): Promise<SettingsData> {
  seedDevDataIfEmpty(input.ownerId);

  const { store, rulesets, players } = makeRepos();

  const ownedGroups = [...store.groups.values()]
    .filter((g) => g.ownerId === input.ownerId)
    .sort((a, b) => (a.createdAt > b.createdAt ? 1 : a.createdAt < b.createdAt ? -1 : 0));

  if (ownedGroups.length === 0) {
    return { group: null, rulesets: [], players: [] };
  }

  // Honour the caller's `groupId` selection when present and owned;
  // otherwise default to the first owned Group.
  const requested =
    input.groupId !== undefined ? ownedGroups.find((g) => g.id === input.groupId) : undefined;
  const active = (requested ?? ownedGroups[0]) as Group;
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
}

export async function createRulesetHandler(
  input: CreateRulesetServerInput,
): Promise<SettingsRulesetItem> {
  const { store, rulesetService } = makeRepos();
  await assertGroupOwnedBy(store, input.groupId, input.ownerId);

  const newRow: NewRuleset = {
    id: globalThis.crypto.randomUUID(),
    groupId: input.groupId,
    ...input.input,
  };
  try {
    const ruleset = await rulesetService.create(newRow);
    const group = store.groups.get(input.groupId);
    return projectRuleset(ruleset, group?.defaultRulesetId ?? null);
  } catch (cause) {
    rethrowDomainError(cause);
  }
}

export async function updateRulesetHandler(
  input: UpdateRulesetServerInput,
): Promise<SettingsRulesetItem | null> {
  const { store, rulesetService, rulesets } = makeRepos();
  const existing = await rulesets.findById(input.rulesetId);
  if (existing === null) return null;
  await assertGroupOwnedBy(store, existing.groupId, input.ownerId);

  try {
    const updated = await rulesetService.update(input.rulesetId, input.input);
    if (updated === null) return null;
    const group = store.groups.get(updated.groupId);
    return projectRuleset(updated, group?.defaultRulesetId ?? null);
  } catch (cause) {
    rethrowDomainError(cause);
  }
}

export async function deleteRulesetHandler(
  input: DeleteRulesetServerInput,
): Promise<{ deleted: boolean }> {
  const { store, rulesetService, rulesets } = makeRepos();
  const existing = await rulesets.findById(input.rulesetId);
  if (existing === null) return { deleted: false };
  await assertGroupOwnedBy(store, existing.groupId, input.ownerId);

  // Refuse to delete the Group's current default Ruleset — the schema would
  // null it out silently otherwise. The UI also disables the affordance, but
  // we re-check here to close the TOCTOU window.
  const group = store.groups.get(existing.groupId);
  if (group?.defaultRulesetId === existing.id) {
    throw new Error(
      'Ruleset is set as the group default; pick another default first before deleting.',
    );
  }

  const deleted = await rulesetService.delete(input.rulesetId);
  return { deleted };
}

export async function setDefaultRulesetHandler(
  input: SetDefaultRulesetServerInput,
): Promise<{ ok: boolean }> {
  const { store, rulesets } = makeRepos();
  const existing = await rulesets.findById(input.rulesetId);
  if (existing === null) return { ok: false };
  await assertGroupOwnedBy(store, existing.groupId, input.ownerId);

  const group = store.groups.get(existing.groupId);
  if (!group) return { ok: false };
  store.groups.set(group.id, { ...group, defaultRulesetId: existing.id });
  return { ok: true };
}

export async function createPlayerHandler(
  input: CreatePlayerServerInput,
): Promise<SettingsPlayerItem> {
  const { store, playerService } = makeRepos();
  await assertGroupOwnedBy(store, input.groupId, input.ownerId);

  const newRow: NewPlayer = {
    id: globalThis.crypto.randomUUID(),
    groupId: input.groupId,
    name: input.name,
    isActive: true,
  };
  const player = await playerService.create(newRow);
  // New players have no history by definition.
  return { id: player.id, name: player.name, isActive: player.isActive, hasHistory: false };
}

export async function renamePlayerHandler(
  input: RenamePlayerServerInput,
): Promise<SettingsPlayerItem | null> {
  const { store, playerService, players } = makeRepos();
  const existing = await players.findById(input.playerId);
  if (existing === null) return null;
  await assertGroupOwnedBy(store, existing.groupId, input.ownerId);

  const updated = await playerService.update(input.playerId, { name: input.name });
  if (updated === null) return null;
  const hasHistory = await players.hasGameHistory(updated.id);
  return { id: updated.id, name: updated.name, isActive: updated.isActive, hasHistory };
}

export async function deletePlayerHandler(
  input: PlayerIdServerInput,
): Promise<{ deleted: boolean }> {
  const { store, playerService, players } = makeRepos();
  const existing = await players.findById(input.playerId);
  if (existing === null) return { deleted: false };
  await assertGroupOwnedBy(store, existing.groupId, input.ownerId);

  try {
    const deleted = await playerService.delete(input.playerId);
    return { deleted };
  } catch (cause) {
    if (cause instanceof PlayerHasHistoryError) {
      throw new Error(`Player ${input.playerId} has game history; deactivate instead of deleting.`);
    }
    throw cause;
  }
}

export async function deactivatePlayerHandler(
  input: PlayerIdServerInput,
): Promise<SettingsPlayerItem | null> {
  const { store, playerService, players } = makeRepos();
  const existing = await players.findById(input.playerId);
  if (existing === null) return null;
  await assertGroupOwnedBy(store, existing.groupId, input.ownerId);

  const updated = await playerService.deactivate(input.playerId);
  if (updated === null) return null;
  const hasHistory = await players.hasGameHistory(updated.id);
  return { id: updated.id, name: updated.name, isActive: updated.isActive, hasHistory };
}

export async function reactivatePlayerHandler(
  input: PlayerIdServerInput,
): Promise<SettingsPlayerItem | null> {
  const { store, playerService, players } = makeRepos();
  const existing = await players.findById(input.playerId);
  if (existing === null) return null;
  await assertGroupOwnedBy(store, existing.groupId, input.ownerId);

  const updated = await playerService.reactivate(input.playerId);
  if (updated === null) return null;
  const hasHistory = await players.hasGameHistory(updated.id);
  return { id: updated.id, name: updated.name, isActive: updated.isActive, hasHistory };
}

// ---------------------------------------------------------------------------
// Server function wrappers
// ---------------------------------------------------------------------------

export const getSettingsServerFn = createServerFn({ method: 'GET' })
  .inputValidator(settingsInput)
  .handler(({ data }) => getSettingsHandler(data));

export const createRulesetServerFn = createServerFn({ method: 'POST' })
  .inputValidator(createRulesetInput)
  .handler(({ data }) => createRulesetHandler(data));

export const updateRulesetServerFn = createServerFn({ method: 'POST' })
  .inputValidator(updateRulesetInput)
  .handler(({ data }) => updateRulesetHandler(data));

export const deleteRulesetServerFn = createServerFn({ method: 'POST' })
  .inputValidator(deleteRulesetInput)
  .handler(({ data }) => deleteRulesetHandler(data));

export const setDefaultRulesetServerFn = createServerFn({ method: 'POST' })
  .inputValidator(setDefaultRulesetInput)
  .handler(({ data }) => setDefaultRulesetHandler(data));

export const createPlayerServerFn = createServerFn({ method: 'POST' })
  .inputValidator(createPlayerInput)
  .handler(({ data }) => createPlayerHandler(data));

export const renamePlayerServerFn = createServerFn({ method: 'POST' })
  .inputValidator(renamePlayerInput)
  .handler(({ data }) => renamePlayerHandler(data));

export const deletePlayerServerFn = createServerFn({ method: 'POST' })
  .inputValidator(playerIdInput)
  .handler(({ data }) => deletePlayerHandler(data));

export const deactivatePlayerServerFn = createServerFn({ method: 'POST' })
  .inputValidator(playerIdInput)
  .handler(({ data }) => deactivatePlayerHandler(data));

export const reactivatePlayerServerFn = createServerFn({ method: 'POST' })
  .inputValidator(playerIdInput)
  .handler(({ data }) => reactivatePlayerHandler(data));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function projectRuleset(
  ruleset: Ruleset,
  groupDefaultRulesetId: string | null,
): SettingsRulesetItem {
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
}

/**
 * Verifies that `groupId` exists and is owned by `ownerId`. Throws a generic
 * `Error` otherwise — this is the security boundary for every mutation on
 * this screen; we never surface a more granular reason because the only
 * legitimate caller (the route's loader-fed UI) cannot land here with a
 * mismatched id.
 */
function assertGroupOwnedBy(
  store: GroupServerStore,
  groupId: string,
  ownerId: string,
): Promise<void> {
  const group = store.groups.get(groupId);
  if (!group || group.ownerId !== ownerId) {
    return Promise.reject(new Error('Group not found or not owned by caller.'));
  }
  return Promise.resolve();
}

/**
 * Translates known domain errors into serialisable `Error` shapes so the
 * client can render the message verbatim. Currently covers
 * `TobiConfigurationError`; unknown causes bubble up untouched.
 */
function rethrowDomainError(cause: unknown): never {
  if (cause instanceof TobiConfigurationError) {
    throw new Error(cause.message);
  }
  throw cause;
}

// ---------------------------------------------------------------------------
// In-memory repositories
// ---------------------------------------------------------------------------
// Same pattern as `MemoryGroupRepository` etc. in `server/groups.ts`. The
// store key for `players` is already declared on `GroupServerStore`, so we
// only need to read / write through it.

class MemoryRulesetRepository implements RulesetRepository {
  constructor(private readonly store: GroupServerStore) {}

  async findById(id: string): Promise<Ruleset | null> {
    return this.store.rulesets.get(id) ?? null;
  }

  async listByGroup(groupId: string): Promise<Ruleset[]> {
    return [...this.store.rulesets.values()].filter((r) => r.groupId === groupId);
  }

  async create(input: InMemoryStoreShape['rulesets']): Promise<Ruleset> {
    const row: Ruleset = {
      tobiEnabled: false,
      tobiPoint: null,
      ...input,
    } as Ruleset;
    this.store.rulesets.set(row.id, row);
    return row;
  }

  async update(id: string, input: Partial<Omit<Ruleset, 'id'>>): Promise<Ruleset | null> {
    const existing = this.store.rulesets.get(id);
    if (!existing) return null;
    const next = { ...existing, ...input };
    this.store.rulesets.set(id, next);
    return next;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.rulesets.delete(id);
  }
}

class MemoryPlayerRepository implements PlayerRepository {
  constructor(private readonly store: GroupServerStore) {}

  async findById(id: string): Promise<Player | null> {
    return this.store.players.get(id) ?? null;
  }

  async listByGroup(groupId: string): Promise<Player[]> {
    return [...this.store.players.values()].filter((p) => p.groupId === groupId);
  }

  async create(input: InMemoryStoreShape['players']): Promise<Player> {
    const row: Player = {
      createdAt: new Date().toISOString(),
      isActive: true,
      ...input,
    } as Player;
    this.store.players.set(row.id, row);
    return row;
  }

  async update(id: string, input: Partial<Omit<Player, 'id'>>): Promise<Player | null> {
    const existing = this.store.players.get(id);
    if (!existing) return null;
    const next = { ...existing, ...input };
    this.store.players.set(id, next);
    return next;
  }

  async hasGameHistory(_id: string): Promise<boolean> {
    // GameResult is not yet modelled in the in-memory store; see file header
    // for why this always returns false today.
    return false;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.players.delete(id);
  }
}
