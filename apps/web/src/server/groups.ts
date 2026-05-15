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
 * What is still TODO (out of scope for Issue #15):
 *   The TanStack Start ↔ Workers integration that would expose `env.DB` to a
 *   server function is not yet wired (see `worker/index.ts`: "The full
 *   TanStack Start ↔ Workers integration ... is tracked as a follow-up
 *   issue"). Until that lands, this module backs its `GroupService` /
 *   `GameService` instances with an in-process `Map` (`makeMemoryRepos`).
 *   Crucially, the data lives on the *server* side of the RPC boundary:
 *     - The state survives navigation, but not a Node process restart.
 *     - The client cannot mutate it without going through a server function.
 *   When the D1 binding becomes reachable from a server function, the only
 *   change required is swapping `makeMemoryRepos()` for a factory that
 *   returns `Drizzle*Repository` instances backed by `env.DB`.
 *
 * Owner identity:
 *   D1 access is required to validate a Better Auth session server-side, so
 *   for now the client passes `ownerId` to every server function. This is
 *   the same value `_owner.tsx` `beforeLoad` already exposes from
 *   `authClient.getSession()`. When server functions gain D1 access we will
 *   replace this with a server-side session read; the call signature on the
 *   client stays the same because the loader / mutation wrappers in this
 *   file own the conversion.
 */

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type { GroupListItem } from '../components/groups';
import type { Game, Group, Ruleset } from '../db/schema';
import type {
  GameRepository,
  GroupRepository,
  RulesetRepository,
} from '../repositories/interfaces';
import { GroupHasHistoryError, GroupService } from '../services/group-service';
import {
  type GroupServerStore,
  getGroupServerStore,
  type InMemoryStoreShape,
  seedDevDataIfEmpty,
} from './groups-store';

// ---------------------------------------------------------------------------
// Repository facade
// ---------------------------------------------------------------------------
// The route layer should not know which storage is backing the service. The
// `makeRepos` factory returns a freshly-instantiated `GroupService` and
// exposes the repositories it owns, so the server-function bodies stay
// declarative. The current implementation returns in-memory repositories; the
// D1-backed swap is a one-file change here.

interface ServerRepos {
  service: GroupService;
  groups: GroupRepository;
  rulesets: RulesetRepository;
  games: GameRepository;
}

function makeRepos(): ServerRepos {
  const store = getGroupServerStore();
  const groups = new MemoryGroupRepository(store);
  const rulesets = new MemoryRulesetRepository(store);
  const games = new MemoryGameRepository(store);
  const service = new GroupService({
    groups,
    rulesets,
    games,
    generateId: () => globalThis.crypto.randomUUID(),
  });
  return { service, groups, rulesets, games };
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
// The handler logic is exported separately from the `createServerFn` wrappers
// so that unit tests can exercise it without bundling the RPC compiler. The
// wrappers below are 1:1 with the handlers and exist solely to declare the
// validator + RPC method to TanStack Start.

const listGroupsInput = z.object({ ownerId: z.string().min(1) });
const createGroupInput = z.object({
  ownerId: z.string().min(1),
  name: z.string().trim().min(1).max(60),
});
const renameGroupInput = z.object({
  ownerId: z.string().min(1),
  groupId: z.string().min(1),
  name: z.string().trim().min(1).max(60),
});
const deleteGroupInput = z.object({
  ownerId: z.string().min(1),
  groupId: z.string().min(1),
});

export type ListGroupsInput = z.infer<typeof listGroupsInput>;
export type CreateGroupInput = z.infer<typeof createGroupInput>;
export type RenameGroupInput = z.infer<typeof renameGroupInput>;
export type DeleteGroupInput = z.infer<typeof deleteGroupInput>;

/**
 * Returns the `GroupListItem[]` projection used by the S4 list. Filters by
 * `ownerId` so cross-owner reads never happen even if the client tampers
 * with the request (the eventual server-side session check will narrow this
 * further; for now the filter at the service layer is the only enforcement).
 */
export async function listGroupsHandler(
  input: ListGroupsInput,
): Promise<ReadonlyArray<GroupListItem>> {
  // Materialise the dev fixtures on the first call per owner. No-op
  // afterwards. Lives behind the in-memory storage swap so it disappears
  // when D1 is wired.
  seedDevDataIfEmpty(input.ownerId);

  const { service, games } = makeRepos();
  const groups = await service.listByOwner(input.ownerId);

  return Promise.all(
    groups.map(async (group): Promise<GroupListItem> => {
      const gamesForGroup = await games.listByGroup(group.id);
      return projectToListItem(group, gamesForGroup);
    }),
  );
}

/**
 * Runs `GroupService.createWithDefaultRuleset`. Returns the freshly-created
 * `GroupListItem` so the route can show it without waiting for the next list
 * re-fetch (though the route also `invalidate`s).
 */
export async function createGroupHandler(input: CreateGroupInput): Promise<GroupListItem> {
  const { service } = makeRepos();
  const { group } = await service.createWithDefaultRuleset({
    ownerId: input.ownerId,
    name: input.name,
  });
  // Brand-new Group has no Games yet; we don't bother re-fetching.
  return projectToListItem(group, []);
}

/**
 * Updates `groups.name` only. Returns `null` when the Group does not exist
 * (mismatched ids from a stale UI state); the caller treats `null` as
 * "refresh the list".
 */
export async function renameGroupHandler(input: RenameGroupInput): Promise<GroupListItem | null> {
  const { service, games } = makeRepos();
  // Guard against cross-owner mutation. If the row exists but belongs to
  // someone else, we return `null` rather than 403; the loader's
  // ownership-filtered list is the source of truth for the UI anyway.
  const existing = await service.findById(input.groupId);
  if (existing === null || existing.ownerId !== input.ownerId) return null;

  const updated = await service.rename(input.groupId, input.name);
  if (updated === null) return null;
  const gamesForGroup = await games.listByGroup(updated.id);
  return projectToListItem(updated, gamesForGroup);
}

/**
 * History-aware delete. Throws `GroupHasHistoryError` when Games exist (the
 * modal pre-checks via `hasHistory`, but we re-check server-side to close
 * the TOCTOU window). Returns `{ deleted: true }` on success and `{ deleted:
 * false }` for "row not found / not yours" so the client can resync.
 */
export async function deleteGroupHandler(input: DeleteGroupInput): Promise<{ deleted: boolean }> {
  const { service } = makeRepos();
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
}

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------
// These are the only exports the route file imports — the handlers above are
// the testable seams, and these wrappers register them with TanStack Start
// so they cross the RPC boundary in production.

export const listGroupsServerFn = createServerFn({ method: 'GET' })
  .inputValidator(listGroupsInput)
  .handler(({ data }) => listGroupsHandler(data));

export const createGroupServerFn = createServerFn({ method: 'POST' })
  .inputValidator(createGroupInput)
  .handler(({ data }) => createGroupHandler(data));

export const renameGroupServerFn = createServerFn({ method: 'POST' })
  .inputValidator(renameGroupInput)
  .handler(({ data }) => renameGroupHandler(data));

export const deleteGroupServerFn = createServerFn({ method: 'POST' })
  .inputValidator(deleteGroupInput)
  .handler(({ data }) => deleteGroupHandler(data));

// ---------------------------------------------------------------------------
// Projection helper
// ---------------------------------------------------------------------------

function projectToListItem(group: Group, games: ReadonlyArray<Game>): GroupListItem {
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
}

// ---------------------------------------------------------------------------
// In-memory repository implementations
// ---------------------------------------------------------------------------
// These exist because TanStack Start cannot yet reach `env.DB` from a server
// function. They are deliberately *not* exported — the only sanctioned access
// path is via `makeRepos()` above, which means a future Drizzle-backed swap
// is a one-line change at the factory.
//
// Why we don't reuse `tests/unit/services/fakes.ts`:
//   The test fakes intentionally start empty per `it`. The server store
//   needs to persist across requests within a single dev session; sharing a
//   module-level `Map` is exactly that. Keeping the two implementations
//   separate also means we can swap this one to Drizzle without disturbing
//   the unit tests.

class MemoryGroupRepository implements GroupRepository {
  constructor(private readonly store: GroupServerStore) {}

  async findById(id: string): Promise<Group | null> {
    return this.store.groups.get(id) ?? null;
  }

  async listByOwner(ownerId: string): Promise<Group[]> {
    return [...this.store.groups.values()].filter((g) => g.ownerId === ownerId);
  }

  async create(input: InMemoryStoreShape['groups']): Promise<Group> {
    const row: Group = {
      // Domain rows in Drizzle carry `createdAt` populated by SQLite default;
      // for the in-memory store we set it explicitly so the shape matches
      // `Group` exactly.
      createdAt: new Date().toISOString(),
      defaultRulesetId: null,
      ...input,
    } as Group;
    this.store.groups.set(row.id, row);
    return row;
  }

  async update(id: string, input: Partial<Omit<Group, 'id'>>): Promise<Group | null> {
    const existing = this.store.groups.get(id);
    if (!existing) return null;
    const next = { ...existing, ...input };
    this.store.groups.set(id, next);
    return next;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.groups.delete(id);
  }
}

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

class MemoryGameRepository implements GameRepository {
  constructor(private readonly store: GroupServerStore) {}

  async findById(id: string): Promise<Game | null> {
    return this.store.games.get(id) ?? null;
  }

  async listByGroup(groupId: string): Promise<Game[]> {
    return [...this.store.games.values()].filter((g) => g.groupId === groupId);
  }

  async listByMatch(matchId: string): Promise<Game[]> {
    return [...this.store.games.values()].filter((g) => g.matchId === matchId);
  }

  async listByLeague(leagueId: string): Promise<Game[]> {
    return [...this.store.games.values()].filter((g) => g.leagueId === leagueId);
  }

  async create(input: InMemoryStoreShape['games']): Promise<Game> {
    const row: Game = {
      createdAt: new Date().toISOString(),
      matchId: null,
      leagueId: null,
      ...input,
    } as Game;
    this.store.games.set(row.id, row);
    return row;
  }

  async update(id: string, input: Partial<Omit<Game, 'id'>>): Promise<Game | null> {
    const existing = this.store.games.get(id);
    if (!existing) return null;
    const next = { ...existing, ...input };
    this.store.games.set(id, next);
    return next;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.games.delete(id);
  }
}
