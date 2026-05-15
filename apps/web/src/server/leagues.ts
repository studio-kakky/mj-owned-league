/**
 * TanStack Start server functions for the S7 / S8 / S15 League screens
 * (`04-screens.md` § S7 / S8 / S15, Issue #18).
 *
 * Shape & boundaries — mirrors `server/groups.ts` (Issue #15) and
 * `server/settings.ts` (Issue #17):
 *
 *   - Handlers (`listLeaguesHandler`, `createLeagueHandler`,
 *     `getLeagueDetailHandler`) are exported separately from the
 *     `createServerFn` wrappers so unit tests can drive them without
 *     bundling the RPC compiler. The wrappers exist solely to register
 *     the validator + RPC method with TanStack Start.
 *
 *   - The route layer is the only place that crosses the RPC boundary.
 *     The presentational `LeagueListScreen` / `LeagueDetailScreen`
 *     components never import this file.
 *
 *   - The handlers reuse the shared in-memory store
 *     (`getGroupServerStore`) so writes are visible across screens within
 *     a single dev session. When the D1 binding becomes reachable from a
 *     server function (#39) the `makeRepos` factory is the only place
 *     that has to change.
 *
 * publicSlug generation:
 *   The slug is generated server-side (the client must not be trusted to
 *   pick its own slug — it would let an Owner brute-force collisions for a
 *   neighbouring Owner's League). We use `globalThis.crypto.randomUUID()`
 *   and trim it to 16 characters so the slug fits comfortably in a URL bar
 *   without losing collision resistance: 16 hex chars = 64 bits of entropy.
 *   We loop up to {@link PUBLIC_SLUG_MAX_RETRIES} times until we hit an
 *   unused slug; the chance of even one collision per call is 2^-64.
 *
 * Group ownership check:
 *   Every mutation cross-checks that the target Group belongs to the
 *   caller. We never trust the `groupId` value on the wire — even though
 *   the UI only exposes the Owner's own Groups, the server is still the
 *   security boundary.
 */

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type {
  LeagueDetailData,
  LeagueGameRow,
  LeagueGroupOption,
  LeagueListData,
  LeagueListItem,
  LeagueMatchRow,
  LeagueRankingRow,
  LeagueRulesetOption,
  LeagueRulesetOptionWithGroup,
} from '../components/leagues';
import { LEAGUE_DETAIL_RECENT_GAMES_LIMIT } from '../components/leagues';
import type { Game, League, Match, NewLeague, Ruleset } from '../db/schema';
import { LEAGUE_FORMATS } from '../db/schema';
import type {
  GameRepository,
  LeagueRepository,
  MatchRepository,
  RulesetRepository,
} from '../repositories/interfaces';
import { LeagueService } from '../services/league-service';
import {
  type GroupServerStore,
  getGroupServerStore,
  type InMemoryStoreShape,
  seedDevDataIfEmpty,
} from './groups-store';

// ---------------------------------------------------------------------------
// Repository facade
// ---------------------------------------------------------------------------
// Same shape as the other server modules. We construct fresh services per
// call so they pick up the latest in-memory store state.

interface ServerRepos {
  store: GroupServerStore;
  service: LeagueService;
  leagues: LeagueRepository;
  rulesets: RulesetRepository;
  matches: MatchRepository;
  games: GameRepository;
}

function makeRepos(): ServerRepos {
  const store = getGroupServerStore();
  const leagues = new MemoryLeagueRepository(store);
  const rulesets = new MemoryRulesetRepository(store);
  const matches = new MemoryMatchRepository(store);
  const games = new MemoryGameRepository(store);
  return {
    store,
    leagues,
    rulesets,
    matches,
    games,
    service: new LeagueService(leagues),
  };
}

// ---------------------------------------------------------------------------
// Input validators
// ---------------------------------------------------------------------------

const listLeaguesInput = z.object({ ownerId: z.string().min(1) });
const leagueDetailInput = z.object({
  ownerId: z.string().min(1),
  leagueId: z.string().min(1),
});
const createLeagueInput = z.object({
  ownerId: z.string().min(1),
  groupId: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  format: z.enum(LEAGUE_FORMATS),
  // `null` lets the server fall back to the Group's default Ruleset. A
  // bare `undefined` would be ambiguous (omitted vs. explicit null), so
  // we require an explicit value on the wire.
  defaultRulesetId: z.string().min(1).nullable(),
});

export type ListLeaguesInput = z.infer<typeof listLeaguesInput>;
export type LeagueDetailInput = z.infer<typeof leagueDetailInput>;
export type CreateLeagueInput = z.infer<typeof createLeagueInput>;

// ---------------------------------------------------------------------------
// publicSlug generation
// ---------------------------------------------------------------------------

/**
 * Number of retries when we hit an in-use slug. 5 is overkill at 64 bits of
 * entropy but cheap to declare; it also bounds the worst-case CPU when the
 * RNG is mocked in a test.
 */
export const PUBLIC_SLUG_MAX_RETRIES = 5;

/**
 * Returns the next unused slug. Exported for testing — production callers
 * use it transitively through {@link createLeagueHandler}.
 */
export async function generatePublicSlug(
  leagues: LeagueRepository,
  random: () => string = defaultRandomSlug,
): Promise<string> {
  for (let attempt = 0; attempt < PUBLIC_SLUG_MAX_RETRIES; attempt++) {
    const candidate = random();
    const existing = await leagues.findByPublicSlug(candidate);
    if (existing === null) return candidate;
  }
  // Practically unreachable (2^-64 collision per try × 5 tries). If we do hit
  // it the throw is preferable to silently overwriting a sibling League.
  throw new Error(
    `Failed to generate a unique publicSlug after ${PUBLIC_SLUG_MAX_RETRIES} attempts.`,
  );
}

function defaultRandomSlug(): string {
  // 16 hex chars = 64 bits of entropy; URL-safe; lowercase looks tidier in
  // the address bar than the full UUID.
  return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Returns the full S7 / S15 payload: every League owned by the caller (cross-
 * Group) plus the create-modal's Group / Ruleset options. Ownership is
 * enforced by intersecting League.groupId with the caller's Groups; this
 * matches what the future server-side session read will narrow further.
 *
 * Bundling the modal options into the same response keeps the page on a
 * single round trip — see the comment on {@link LeagueListData}.
 */
export async function listLeaguesHandler(input: ListLeaguesInput): Promise<LeagueListData> {
  seedDevDataIfEmpty(input.ownerId);
  const { store } = makeRepos();

  const ownedGroups = [...store.groups.values()].filter((g) => g.ownerId === input.ownerId);
  const ownedGroupIds = new Set(ownedGroups.map((g) => g.id));
  const groupNameById = new Map(ownedGroups.map((g) => [g.id, g.name] as const));

  const items: LeagueListItem[] = [];
  for (const league of store.leagues.values()) {
    if (!ownedGroupIds.has(league.groupId)) continue;
    items.push(projectListItem(league, store, groupNameById));
  }

  // Most-recently-active first. Leagues with no Games yet sort behind any
  // League that does have games; among themselves they keep insertion order.
  const leagues = items.sort((a, b) => {
    if (a.lastPlayedAt === null && b.lastPlayedAt === null) return 0;
    if (a.lastPlayedAt === null) return 1;
    if (b.lastPlayedAt === null) return -1;
    return a.lastPlayedAt > b.lastPlayedAt ? -1 : 1;
  });

  // Sort Group options by createdAt ascending so the dropdown matches the
  // order Owners see elsewhere (S4 / S16). Falls back to insertion order
  // when createdAt ties.
  const groups: ReadonlyArray<LeagueGroupOption> = ownedGroups
    .slice()
    .sort((a, b) => (a.createdAt > b.createdAt ? 1 : a.createdAt < b.createdAt ? -1 : 0))
    .map(
      (g): LeagueGroupOption => ({
        id: g.id,
        name: g.name,
        defaultRulesetId: g.defaultRulesetId,
      }),
    );

  // Rulesets across every owned Group, tagged with `groupId` so the modal
  // can filter client-side.
  const rulesets: LeagueRulesetOptionWithGroup[] = [];
  for (const ruleset of store.rulesets.values()) {
    if (!ownedGroupIds.has(ruleset.groupId)) continue;
    const group = store.groups.get(ruleset.groupId);
    rulesets.push({
      ...projectRulesetOption(ruleset, group?.defaultRulesetId ?? null),
      groupId: ruleset.groupId,
    });
  }

  return { leagues, groups, rulesets };
}

/**
 * Builds the {@link LeagueDetailData} payload for the S7 detail view.
 *
 * Returns `null` when the League does not exist or is owned by a different
 * Owner — the route surfaces that as a 404 / redirect rather than throwing.
 *
 * The ranking computation is intentionally minimal: the in-memory store
 * does not yet model `GameResult` rows, so we surface an empty `ranking`
 * array. When `GameResult` arrives (with the D1 swap tracked in #39) this is
 * the only place that needs to start running the domain scoring module.
 */
export async function getLeagueDetailHandler(
  input: LeagueDetailInput,
): Promise<LeagueDetailData | null> {
  seedDevDataIfEmpty(input.ownerId);
  const { store } = makeRepos();

  const league = store.leagues.get(input.leagueId) ?? null;
  if (league === null) return null;
  const group = store.groups.get(league.groupId);
  if (!group || group.ownerId !== input.ownerId) return null;

  const matches = [...store.matches.values()].filter((m) => m.leagueId === league.id);
  const games = [...store.games.values()].filter((g) => g.leagueId === league.id);
  const matchNameById = new Map(matches.map((m) => [m.id, m.name] as const));

  const gameCountByMatch = new Map<string, number>();
  for (const g of games) {
    if (g.matchId === null) continue;
    gameCountByMatch.set(g.matchId, (gameCountByMatch.get(g.matchId) ?? 0) + 1);
  }

  // Match list — surface most-recent `heldAt` first, falling back to
  // `sequenceNumber` descending for Matches without a date.
  const matchRows: LeagueMatchRow[] = matches
    .map(
      (m): LeagueMatchRow => ({
        id: m.id,
        name: m.name,
        sequenceNumber: m.sequenceNumber,
        heldAt: m.heldAt,
        gameCount: gameCountByMatch.get(m.id) ?? 0,
      }),
    )
    .sort((a, b) => compareMatchRows(a, b));

  // Recent games feed, capped per the typed constant.
  const recentGameRows: LeagueGameRow[] = games
    .slice()
    .sort((a, b) => (a.playedAt > b.playedAt ? -1 : a.playedAt < b.playedAt ? 1 : 0))
    .slice(0, LEAGUE_DETAIL_RECENT_GAMES_LIMIT)
    .map(
      (game): LeagueGameRow => ({
        id: game.id,
        matchId: game.matchId,
        matchName: game.matchId === null ? null : (matchNameById.get(game.matchId) ?? null),
        playedAt: game.playedAt,
      }),
    );

  const defaultRulesetRow =
    league.defaultRulesetId === null ? null : (store.rulesets.get(league.defaultRulesetId) ?? null);
  const groupDefault = group.defaultRulesetId;
  const defaultRuleset: LeagueRulesetOption | null =
    defaultRulesetRow === null ? null : projectRulesetOption(defaultRulesetRow, groupDefault);

  // Ranking is stubbed empty until GameResult rows land. We keep the field
  // populated as `[]` so the screen renders the empty-state copy instead of
  // skipping the section entirely. The shape is locked, so wiring real data
  // later is a server-only change.
  const ranking: ReadonlyArray<LeagueRankingRow> = [];

  return {
    id: league.id,
    groupId: group.id,
    groupName: group.name,
    name: league.name,
    format: league.format,
    status: 'ACTIVE',
    publicSlug: league.publicSlug,
    defaultRuleset,
    matches: matchRows,
    recentGames: recentGameRows,
    ranking,
  };
}

/**
 * Creates a League under a Group owned by the caller. Returns the new
 * {@link LeagueListItem} so the route can render it without waiting for the
 * loader to re-fetch.
 *
 * When `defaultRulesetId` is `null` we resolve it to the Group's
 * `defaultRulesetId`. If the Group itself has none (extremely unusual but
 * the schema allows it) the League is created with no default; the caller
 * will pick one per-Match later.
 */
export async function createLeagueHandler(input: CreateLeagueInput): Promise<LeagueListItem> {
  seedDevDataIfEmpty(input.ownerId);
  const { store, service, leagues } = makeRepos();

  const group = store.groups.get(input.groupId);
  if (!group || group.ownerId !== input.ownerId) {
    throw new Error('Group not found or not owned by caller.');
  }

  // Resolve the effective default Ruleset id. Caller may pass null to opt
  // into the Group default; we additionally validate that any explicit id
  // belongs to the same Group (the in-memory dropdown will only surface
  // matching ones, but we re-check defensively).
  let defaultRulesetId: string | null = input.defaultRulesetId;
  if (defaultRulesetId !== null) {
    const ruleset = store.rulesets.get(defaultRulesetId);
    if (!ruleset || ruleset.groupId !== group.id) {
      throw new Error('Ruleset not found in the selected Group.');
    }
  } else {
    defaultRulesetId = group.defaultRulesetId;
  }

  const publicSlug = await generatePublicSlug(leagues);
  const newRow: NewLeague = {
    id: globalThis.crypto.randomUUID(),
    groupId: group.id,
    name: input.name,
    format: input.format,
    defaultRulesetId,
    publicSlug,
  };
  const created = await service.create(newRow);

  const groupNameById = new Map([[group.id, group.name] as const]);
  return projectListItem(created, store, groupNameById);
}

// ---------------------------------------------------------------------------
// Server function wrappers
// ---------------------------------------------------------------------------

export const listLeaguesServerFn = createServerFn({ method: 'GET' })
  .inputValidator(listLeaguesInput)
  .handler(({ data }) => listLeaguesHandler(data));

export const getLeagueDetailServerFn = createServerFn({ method: 'GET' })
  .inputValidator(leagueDetailInput)
  .handler(({ data }) => getLeagueDetailHandler(data));

export const createLeagueServerFn = createServerFn({ method: 'POST' })
  .inputValidator(createLeagueInput)
  .handler(({ data }) => createLeagueHandler(data));

// ---------------------------------------------------------------------------
// Projections
// ---------------------------------------------------------------------------

function projectListItem(
  league: League,
  store: GroupServerStore,
  groupNameById: ReadonlyMap<string, string>,
): LeagueListItem {
  let matchCount = 0;
  for (const m of store.matches.values()) {
    if (m.leagueId === league.id) matchCount++;
  }

  let gameCount = 0;
  let lastPlayedAt: string | null = null;
  for (const g of store.games.values()) {
    if (g.leagueId !== league.id) continue;
    gameCount++;
    if (lastPlayedAt === null || g.playedAt > lastPlayedAt) {
      lastPlayedAt = g.playedAt;
    }
  }

  // `playerCount` counts distinct Players who have a Game in this League.
  // GameResult is not modelled yet; for MVP we approximate "participants" as
  // the active Players in the League's Group. This keeps the card honest
  // (the count reflects reality at the active-roster level) without
  // overstating activity.
  let playerCount = 0;
  for (const p of store.players.values()) {
    if (p.groupId !== league.groupId) continue;
    if (!p.isActive) continue;
    playerCount++;
  }

  return {
    id: league.id,
    groupId: league.groupId,
    groupName: groupNameById.get(league.groupId) ?? '',
    name: league.name,
    format: league.format,
    status: 'ACTIVE',
    matchCount,
    gameCount,
    playerCount,
    lastPlayedAt,
    publicSlug: league.publicSlug,
  };
}

function projectRulesetOption(
  ruleset: Ruleset,
  groupDefaultRulesetId: string | null,
): LeagueRulesetOption {
  return {
    id: ruleset.id,
    name: ruleset.name,
    startingScore: ruleset.startingScore,
    returnScore: ruleset.returnScore,
    umaPattern: ruleset.umaPattern,
    isGroupDefault: groupDefaultRulesetId === ruleset.id,
  };
}

function compareMatchRows(a: LeagueMatchRow, b: LeagueMatchRow): number {
  // Dated matches first, descending by date. Undated matches trail and are
  // sorted by sequenceNumber descending (newer first); null sequenceNumber
  // trails further.
  if (a.heldAt !== null && b.heldAt !== null) {
    return a.heldAt > b.heldAt ? -1 : a.heldAt < b.heldAt ? 1 : 0;
  }
  if (a.heldAt !== null) return -1;
  if (b.heldAt !== null) return 1;
  if (a.sequenceNumber !== null && b.sequenceNumber !== null) {
    return b.sequenceNumber - a.sequenceNumber;
  }
  if (a.sequenceNumber !== null) return -1;
  if (b.sequenceNumber !== null) return 1;
  return 0;
}

// ---------------------------------------------------------------------------
// In-memory repositories
// ---------------------------------------------------------------------------
// Same pattern as `server/groups.ts` and `server/settings.ts`. Lives here
// because TanStack Start cannot yet reach D1 from a server function. When
// that lands, `makeRepos()` is the only call site that has to swap.

class MemoryLeagueRepository implements LeagueRepository {
  constructor(private readonly store: GroupServerStore) {}

  async findById(id: string): Promise<League | null> {
    return this.store.leagues.get(id) ?? null;
  }

  async findByPublicSlug(publicSlug: string): Promise<League | null> {
    for (const league of this.store.leagues.values()) {
      if (league.publicSlug === publicSlug) return league;
    }
    return null;
  }

  async listByGroup(groupId: string): Promise<League[]> {
    return [...this.store.leagues.values()].filter((l) => l.groupId === groupId);
  }

  async create(input: InMemoryStoreShape['leagues']): Promise<League> {
    const row: League = {
      createdAt: new Date().toISOString(),
      defaultRulesetId: null,
      ...input,
    } as League;
    this.store.leagues.set(row.id, row);
    return row;
  }

  async update(id: string, input: Partial<Omit<League, 'id'>>): Promise<League | null> {
    const existing = this.store.leagues.get(id);
    if (!existing) return null;
    const next = { ...existing, ...input };
    this.store.leagues.set(id, next);
    return next;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.leagues.delete(id);
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
