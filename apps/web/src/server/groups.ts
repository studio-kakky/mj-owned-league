/**
 * TanStack Start server functions for the S4 Group 一覧 / S5 Group 作成 screen
 * (Issue #15). These satisfy the acceptance criterion "TanStack Start の
 * loader / action でサーバアクションを書く" — the `/groups` route's loader
 * calls `listGroups`, and the create / rename / delete modals call the
 * matching mutation server functions via `useServerFn`.
 *
 * What is wired:
 *   - The route loader transitions from "client-side useState seed" to a
 *     real server round trip. `vite dev` boots TanStack Start on Node and
 *     each `serverFn({...})` call is dispatched over RPC; the client never
 *     reads the storage module directly.
 *   - Mutations invalidate the route after success so the list re-fetches.
 *   - The data shape (`GroupListItem`) and the service-layer rules
 *     (`createWithDefaultRuleset`, `hasHistory`, `deleteIfNoHistory`) are
 *     centralised in `GroupService`. The server functions here are thin —
 *     they exist to bridge the RPC boundary and to project domain rows into
 *     the screen's shape.
 *
 * Persistence (Issue #39):
 *   The `createServerFn` wrappers build a request-scoped Drizzle client from
 *   the D1 binding (`getRequestDb()`) and pass it into the handlers, so writes
 *   land in D1 and survive process restarts. The handlers keep an optional
 *   `db` parameter; when it is omitted they fall back to the process-wide
 *   in-memory store, which is the seam the unit tests drive.
 *
 * Owner identity (Issue #39):
 *   `ownerId` is resolved server-side from the Better Auth session
 *   (`requireOwnerId()`) inside each wrapper — it is no longer accepted from
 *   the client. The handlers still take `ownerId` explicitly so tests can pass
 *   it directly, but on the wire there is no client-supplied owner id to forge.
 */

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type { GroupListItem } from '../components/groups';
import type { Database } from '../db/client';
import type { Game, Group } from '../db/schema';
import {
  DrizzleGameRepository,
  DrizzleGroupRepository,
  DrizzleRulesetRepository,
} from '../repositories/drizzle';
import type {
  GameRepository,
  GroupRepository,
  RulesetRepository,
} from '../repositories/interfaces';
import { GroupHasHistoryError, GroupService } from '../services/group-service';
import { getRequestDb, requireOwnerId } from './context';
import { getGroupServerStore, seedDevDataIfEmpty } from './groups-store';
import {
  MemoryGameRepository,
  MemoryGroupRepository,
  MemoryRulesetRepository,
} from './memory-repos';

// ---------------------------------------------------------------------------
// Repository facade
// ---------------------------------------------------------------------------
// The route layer should not know which storage is backing the service. The
// `makeRepos` factory returns a freshly-instantiated `GroupService` and
// exposes the repositories it owns, so the server-function bodies stay
// declarative.
//
// Two backings (Issue #39):
//   - Pass a `Database` (the request-scoped Drizzle client from
//     `getRequestDb()`) and the repos talk to D1. This is the production path:
//     the `createServerFn` wrappers below inject it.
//   - Pass nothing and the repos read/write the process-wide in-memory store.
//     This is the seam the unit tests drive — `listGroupsHandler({ ownerId })`
//     with no `db` exercises the same logic against `getGroupServerStore()`.

interface ServerRepos {
  service: GroupService;
  groups: GroupRepository;
  rulesets: RulesetRepository;
  games: GameRepository;
}

const makeRepos = (db?: Database): ServerRepos => {
  const { groups, rulesets, games } = db
    ? {
        groups: new DrizzleGroupRepository(db),
        rulesets: new DrizzleRulesetRepository(db),
        games: new DrizzleGameRepository(db),
      }
    : (() => {
        const store = getGroupServerStore();
        return {
          groups: new MemoryGroupRepository(store),
          rulesets: new MemoryRulesetRepository(store),
          games: new MemoryGameRepository(store),
        };
      })();
  const service = new GroupService({
    groups,
    rulesets,
    games,
    generateId: () => globalThis.crypto.randomUUID(),
  });
  return { service, groups, rulesets, games };
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
// The handler logic is exported separately from the `createServerFn` wrappers
// so that unit tests can exercise it without bundling the RPC compiler. The
// wrappers below are 1:1 with the handlers and exist solely to declare the
// validator + RPC method to TanStack Start.

// Client-facing validators. `ownerId` is intentionally absent: it is resolved
// server-side from the session (`requireOwnerId()`), not accepted from the
// caller. The `*Input` types below add `ownerId` because the handlers — the
// testable seam — still take it explicitly.
const createGroupInput = z.object({
  name: z.string().trim().min(1).max(60),
});
const renameGroupInput = z.object({
  groupId: z.string().min(1),
  name: z.string().trim().min(1).max(60),
});
const deleteGroupInput = z.object({
  groupId: z.string().min(1),
});

export type ListGroupsInput = { ownerId: string };
export type CreateGroupInput = z.infer<typeof createGroupInput> & { ownerId: string };
export type RenameGroupInput = z.infer<typeof renameGroupInput> & { ownerId: string };
export type DeleteGroupInput = z.infer<typeof deleteGroupInput> & { ownerId: string };

// ---------------------------------------------------------------------------
// Projection helper
// ---------------------------------------------------------------------------

const projectToListItem = (group: Group, games: ReadonlyArray<Game>): GroupListItem => {
  // `lastPlayedAt` is the most recent Game's `playedAt`; null when no Games.
  let lastPlayedAt: string | null = null;
  for (const game of games) {
    if (lastPlayedAt === null || game.playedAt > lastPlayedAt) {
      lastPlayedAt = game.playedAt;
    }
  }

  return {
    id: group.id,
    name: group.name,
    // Player / League counts are not part of the in-memory store yet (those
    // entities arrive in later screens). We surface `0` for now; when the
    // service layer learns to aggregate these, this is the only call site
    // that needs to start passing real values.
    playerCount: 0,
    leagueCount: 0,
    lastPlayedAt,
    hasHistory: games.length > 0,
  };
};

/**
 * Returns the `GroupListItem[]` projection used by the S4 list. Filters by
 * `ownerId` so cross-owner reads never happen even if the client tampers
 * with the request (the eventual server-side session check will narrow this
 * further; for now the filter at the service layer is the only enforcement).
 */
export const listGroupsHandler = async (
  input: ListGroupsInput,
  db?: Database,
): Promise<ReadonlyArray<GroupListItem>> => {
  // Materialise the dev fixtures on the first call per owner — memory mode
  // only. With D1 wired the data lives in the database, so we never seed.
  if (!db) seedDevDataIfEmpty(input.ownerId);

  const { service, games } = makeRepos(db);
  const groups = await service.listByOwner(input.ownerId);

  return Promise.all(
    groups.map(async (group): Promise<GroupListItem> => {
      const gamesForGroup = await games.listByGroup(group.id);
      return projectToListItem(group, gamesForGroup);
    }),
  );
};

/**
 * Runs `GroupService.createWithDefaultRuleset`. Returns the freshly-created
 * `GroupListItem` so the route can show it without waiting for the next list
 * re-fetch (though the route also `invalidate`s).
 */
export const createGroupHandler = async (
  input: CreateGroupInput,
  db?: Database,
): Promise<GroupListItem> => {
  const { service } = makeRepos(db);
  const { group } = await service.createWithDefaultRuleset({
    ownerId: input.ownerId,
    name: input.name,
  });
  // Brand-new Group has no Games yet; we don't bother re-fetching.
  return projectToListItem(group, []);
};

/**
 * Updates `groups.name` only. Returns `null` when the Group does not exist
 * (mismatched ids from a stale UI state); the caller treats `null` as
 * "refresh the list".
 */
export const renameGroupHandler = async (
  input: RenameGroupInput,
  db?: Database,
): Promise<GroupListItem | null> => {
  const { service, games } = makeRepos(db);
  // Guard against cross-owner mutation. If the row exists but belongs to
  // someone else, we return `null` rather than 403; the loader's
  // ownership-filtered list is the source of truth for the UI anyway.
  const existing = await service.findById(input.groupId);
  if (existing === null || existing.ownerId !== input.ownerId) return null;

  const updated = await service.rename(input.groupId, input.name);
  if (updated === null) return null;
  const gamesForGroup = await games.listByGroup(updated.id);
  return projectToListItem(updated, gamesForGroup);
};

/**
 * History-aware delete. Throws `GroupHasHistoryError` when Games exist (the
 * modal pre-checks via `hasHistory`, but we re-check server-side to close
 * the TOCTOU window). Returns `{ deleted: true }` on success and `{ deleted:
 * false }` for "row not found / not yours" so the client can resync.
 */
export const deleteGroupHandler = async (
  input: DeleteGroupInput,
  db?: Database,
): Promise<{ deleted: boolean }> => {
  const { service } = makeRepos(db);
  const existing = await service.findById(input.groupId);
  if (existing === null || existing.ownerId !== input.ownerId) {
    return { deleted: false };
  }
  try {
    const deleted = await service.deleteIfNoHistory(input.groupId);
    return { deleted };
  } catch (cause) {
    if (cause instanceof GroupHasHistoryError) {
      // We re-throw a serialisable shape so the client can decode it.
      // TanStack Start's serial protocol passes Error subclasses by name +
      // message, which would lose the `gameCount` field; wrap it in a
      // plain `Error` whose message embeds the count. The UI relies on the
      // pre-fetched `hasHistory` flag for copy, so the error message is
      // never user-visible in the happy path.
      throw new Error(`Group ${input.groupId} has ${cause.gameCount} game(s); cannot be deleted.`);
    }
    throw cause;
  }
};

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------
// These are the only exports the route file imports — the handlers above are
// the testable seams, and these wrappers register them with TanStack Start
// so they cross the RPC boundary in production.

export const listGroupsServerFn = createServerFn({ method: 'GET' }).handler(async () =>
  listGroupsHandler({ ownerId: await requireOwnerId() }, getRequestDb()),
);

export const createGroupServerFn = createServerFn({ method: 'POST' })
  .inputValidator(createGroupInput)
  .handler(async ({ data }) =>
    createGroupHandler({ ...data, ownerId: await requireOwnerId() }, getRequestDb()),
  );

export const renameGroupServerFn = createServerFn({ method: 'POST' })
  .inputValidator(renameGroupInput)
  .handler(async ({ data }) =>
    renameGroupHandler({ ...data, ownerId: await requireOwnerId() }, getRequestDb()),
  );

export const deleteGroupServerFn = createServerFn({ method: 'POST' })
  .inputValidator(deleteGroupInput)
  .handler(async ({ data }) =>
    deleteGroupHandler({ ...data, ownerId: await requireOwnerId() }, getRequestDb()),
  );
