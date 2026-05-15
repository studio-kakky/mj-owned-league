/**
 * TanStack Start server functions for the S10 Match 作成 screen
 * (`04-screens.md` § S10, `03-user-flow.md` § F5, Issue #20).
 *
 * Shape & boundaries — mirrors `server/leagues.ts` (Issue #18):
 *
 *   - Handlers (`getMatchCreateContextHandler`, `createMatchHandler`) are
 *     exported separately from the `createServerFn` wrappers so unit tests
 *     can drive them without bundling the RPC compiler.
 *
 *   - The route layer is the only place that crosses the RPC boundary; the
 *     presentational {@link MatchCreateScreen} never imports this module.
 *
 *   - The handlers reuse the shared in-memory store
 *     (`getGroupServerStore`) so writes are visible across screens within a
 *     single dev session. When the D1 binding becomes reachable (#39) the
 *     `makeRepos` factory is the only place that needs to change.
 *
 * `sequenceNumber` allocation:
 *   The doc (`03-user-flow.md` § F5) says "League 配下の場合は
 *   `sequenceNumber` を自動採番". We compute it as
 *   `max(existing.sequenceNumber) + 1`, defaulting to `1` when the League
 *   has no Matches. The allocation runs both at *context* load time (so
 *   the screen can preview the value) and at *create* time (so a race
 *   between two tabs cannot wedge two Matches onto the same number — the
 *   create handler re-reads the latest max immediately before insert).
 *
 * Group ownership check:
 *   `createMatchHandler` cross-checks that the target Group / League belong
 *   to the caller. We never trust client-supplied ids — even though the UI
 *   only exposes Owner-scoped options, the server is still the security
 *   boundary.
 */

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type {
  CreatedMatchSummary,
  MatchCreateContext,
  MatchCreateGroupOption,
  MatchCreateLeagueOption,
  MatchCreateRulesetOption,
} from '../components/matches';
import type { Game, Match, NewMatch, Ruleset } from '../db/schema';
import type {
  GameRepository,
  MatchRepository,
  RulesetRepository,
} from '../repositories/interfaces';
import { MatchService } from '../services/match-service';
import {
  type GroupServerStore,
  getGroupServerStore,
  type InMemoryStoreShape,
  seedDevDataIfEmpty,
} from './groups-store';

// ---------------------------------------------------------------------------
// Repository facade
// ---------------------------------------------------------------------------

interface ServerRepos {
  store: GroupServerStore;
  service: MatchService;
  matches: MatchRepository;
  rulesets: RulesetRepository;
}

function makeRepos(): ServerRepos {
  const store = getGroupServerStore();
  const matches = new MemoryMatchRepository(store);
  const games = new MemoryGameRepository(store);
  const rulesets = new MemoryRulesetRepository(store);
  return {
    store,
    matches,
    rulesets,
    service: new MatchService(matches, games),
  };
}

// ---------------------------------------------------------------------------
// Input validators
// ---------------------------------------------------------------------------

const getContextInput = z.object({
  ownerId: z.string().min(1),
  /**
   * Optional `?leagueId=` — when supplied the loader pins the screen to that
   * League. Validation only enforces the string shape; ownership / existence
   * are checked in the handler so a stale URL falls through to the
   * unbound-form variant rather than a hard 4xx.
   */
  leagueId: z.string().min(1).optional(),
  /**
   * Optional `?groupId=` — used when the caller arrived from a non-League
   * context (e.g. a Group home page) and wants the form pre-pinned to a
   * particular Group.
   */
  groupId: z.string().min(1).optional(),
});

const createMatchInput = z.object({
  ownerId: z.string().min(1),
  groupId: z.string().min(1),
  /**
   * `null` = League 外 Match. The handler additionally rejects a non-null
   * `leagueId` whose Group does not match `groupId` (defensive cross-check).
   */
  leagueId: z.string().min(1).nullable(),
  name: z.string().trim().min(1).max(60),
  /** ISO `YYYY-MM-DD`. */
  heldAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  memo: z.string().trim().max(240).nullable(),
  defaultRulesetId: z.string().min(1).nullable(),
});

export type GetMatchCreateContextInput = z.infer<typeof getContextInput>;
export type CreateMatchInput = z.infer<typeof createMatchInput>;

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Resolves the loader payload powering the S10 form. Returns the Groups /
 * Leagues / Rulesets the Owner may pick from, plus initial selections derived
 * from the `?leagueId=` / `?groupId=` query.
 *
 * Cross-Owner safety:
 *   - We always start from "Groups owned by the caller". Leagues / Rulesets
 *     surfaced are filtered to those Group ids. A `?leagueId=` pointing at a
 *     foreign League is silently dropped (the loader returns `initialLeagueId
 *     = null`) — the screen then renders the cross-Group form, which is the
 *     safer recovery.
 *
 *   - `?groupId=` is similarly dropped when foreign; we fall back to the
 *     Owner's first Group as the initial selection.
 */
export async function getMatchCreateContextHandler(
  input: GetMatchCreateContextInput,
): Promise<MatchCreateContext> {
  seedDevDataIfEmpty(input.ownerId);
  const { store } = makeRepos();

  const ownedGroups = [...store.groups.values()]
    .filter((g) => g.ownerId === input.ownerId)
    .sort((a, b) => (a.createdAt > b.createdAt ? 1 : a.createdAt < b.createdAt ? -1 : 0));
  const ownedGroupIds = new Set(ownedGroups.map((g) => g.id));

  const groups: ReadonlyArray<MatchCreateGroupOption> = ownedGroups.map((g) => ({
    id: g.id,
    name: g.name,
    defaultRulesetId: g.defaultRulesetId,
  }));

  // Leagues across every owned Group, tagged with `groupId` + `format` so the
  // screen can filter client-side and lock the format selector on League pick.
  const leagues: MatchCreateLeagueOption[] = [];
  for (const league of store.leagues.values()) {
    if (!ownedGroupIds.has(league.groupId)) continue;
    leagues.push({
      id: league.id,
      groupId: league.groupId,
      name: league.name,
      format: league.format,
      defaultRulesetId: league.defaultRulesetId,
    });
  }

  // Rulesets across every owned Group.
  const rulesets: MatchCreateRulesetOption[] = [];
  for (const ruleset of store.rulesets.values()) {
    if (!ownedGroupIds.has(ruleset.groupId)) continue;
    const group = store.groups.get(ruleset.groupId);
    rulesets.push({
      id: ruleset.id,
      groupId: ruleset.groupId,
      name: ruleset.name,
      startingScore: ruleset.startingScore,
      returnScore: ruleset.returnScore,
      umaPattern: ruleset.umaPattern,
      isGroupDefault: group?.defaultRulesetId === ruleset.id,
    });
  }

  // Active-Player counts per Group. We pre-aggregate here so the screen can
  // gate 3-player Match creation without a second round trip.
  const activePlayerCountByGroup: Record<string, number> = {};
  for (const group of ownedGroups) {
    activePlayerCountByGroup[group.id] = 0;
  }
  for (const player of store.players.values()) {
    if (!ownedGroupIds.has(player.groupId)) continue;
    if (!player.isActive) continue;
    activePlayerCountByGroup[player.groupId] = (activePlayerCountByGroup[player.groupId] ?? 0) + 1;
  }

  // Resolve the initial Group / League. A foreign / stale `?leagueId=` is
  // dropped here so the screen renders the unbound form instead of erroring.
  let initialLeagueId: string | null = null;
  let initialGroupId: string | null = null;
  let initialSequenceNumber: number | null = null;

  if (input.leagueId !== undefined) {
    const candidate = leagues.find((l) => l.id === input.leagueId);
    if (candidate !== undefined) {
      initialLeagueId = candidate.id;
      initialGroupId = candidate.groupId;
      initialSequenceNumber = computeNextSequenceNumber(store, candidate.id);
    }
  }

  if (initialGroupId === null) {
    if (input.groupId !== undefined && ownedGroupIds.has(input.groupId)) {
      initialGroupId = input.groupId;
    } else {
      initialGroupId = ownedGroups[0]?.id ?? null;
    }
  }

  return {
    groups,
    leagues,
    rulesets,
    activePlayerCountByGroup,
    initialLeagueId,
    initialGroupId,
    initialSequenceNumber,
  };
}

/**
 * Persists a new Match under a Group owned by the caller.
 *
 * Cross-checks performed before insert:
 *   1. Group exists and is owned by the caller.
 *   2. When `leagueId !== null`, the League exists *and* belongs to the
 *      same Group. The form locks the League selector to the route-locked
 *      League, but we re-check defensively.
 *   3. When `defaultRulesetId !== null`, the Ruleset belongs to the same
 *      Group.
 *
 * `sequenceNumber` is auto-allocated when a League is supplied. Reading the
 * max immediately before insert keeps two concurrent tabs from issuing the
 * same number — within the limits of an in-memory store; under D1 the same
 * read-then-insert pair will run inside a transaction (tracked with #39).
 */
export async function createMatchHandler(input: CreateMatchInput): Promise<CreatedMatchSummary> {
  seedDevDataIfEmpty(input.ownerId);
  const { store, service } = makeRepos();

  const group = store.groups.get(input.groupId);
  if (!group || group.ownerId !== input.ownerId) {
    throw new Error('Group not found or not owned by caller.');
  }

  let leagueId: string | null = null;
  let sequenceNumber: number | null = null;
  if (input.leagueId !== null) {
    const league = store.leagues.get(input.leagueId);
    if (!league || league.groupId !== group.id) {
      throw new Error('League not found in the selected Group.');
    }
    leagueId = league.id;
    sequenceNumber = computeNextSequenceNumber(store, league.id);
  }

  if (input.defaultRulesetId !== null) {
    const ruleset = store.rulesets.get(input.defaultRulesetId);
    if (!ruleset || ruleset.groupId !== group.id) {
      throw new Error('Ruleset not found in the selected Group.');
    }
  }

  const newRow: NewMatch = {
    id: globalThis.crypto.randomUUID(),
    groupId: group.id,
    leagueId,
    name: input.name,
    sequenceNumber,
    heldAt: input.heldAt,
    memo: input.memo,
    defaultRulesetId: input.defaultRulesetId,
  };
  const created: Match = await service.create(newRow);

  return {
    id: created.id,
    groupId: created.groupId,
    leagueId: created.leagueId,
    name: created.name,
    sequenceNumber: created.sequenceNumber,
  };
}

/**
 * Returns the next `sequenceNumber` for a League. Exported for testing —
 * production callers go through {@link getMatchCreateContextHandler} or
 * {@link createMatchHandler}.
 */
export function computeNextSequenceNumber(store: GroupServerStore, leagueId: string): number {
  let max = 0;
  for (const m of store.matches.values()) {
    if (m.leagueId !== leagueId) continue;
    if (m.sequenceNumber !== null && m.sequenceNumber > max) {
      max = m.sequenceNumber;
    }
  }
  return max + 1;
}

// ---------------------------------------------------------------------------
// Server function wrappers
// ---------------------------------------------------------------------------

export const getMatchCreateContextServerFn = createServerFn({ method: 'GET' })
  .inputValidator(getContextInput)
  .handler(({ data }) => getMatchCreateContextHandler(data));

export const createMatchServerFn = createServerFn({ method: 'POST' })
  .inputValidator(createMatchInput)
  .handler(({ data }) => createMatchHandler(data));

// ---------------------------------------------------------------------------
// In-memory repositories
// ---------------------------------------------------------------------------
// Same pattern as `server/leagues.ts`. Kept private to this module — when
// the D1 binding lands (#39) the constructor calls in `makeRepos` are the
// only edits.

class MemoryMatchRepository implements MatchRepository {
  constructor(private readonly store: GroupServerStore) {}

  async findById(id: string): Promise<Match | null> {
    return this.store.matches.get(id) ?? null;
  }

  async listByGroup(groupId: string): Promise<Match[]> {
    return [...this.store.matches.values()].filter((m) => m.groupId === groupId);
  }

  async listByLeague(leagueId: string): Promise<Match[]> {
    return [...this.store.matches.values()].filter((m) => m.leagueId === leagueId);
  }

  async create(input: InMemoryStoreShape['matches']): Promise<Match> {
    const row: Match = {
      createdAt: new Date().toISOString(),
      heldAt: null,
      memo: null,
      sequenceNumber: null,
      defaultRulesetId: null,
      leagueId: null,
      ...input,
    } as Match;
    this.store.matches.set(row.id, row);
    return row;
  }

  async update(id: string, input: Partial<Omit<Match, 'id'>>): Promise<Match | null> {
    const existing = this.store.matches.get(id);
    if (!existing) return null;
    const next = { ...existing, ...input };
    this.store.matches.set(id, next);
    return next;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.matches.delete(id);
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
