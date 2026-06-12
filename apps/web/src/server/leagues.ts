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
import type { Database } from '../db/client';
import type { GameResult, League, NewLeague, Ruleset } from '../db/schema';
import { LEAGUE_FORMATS } from '../db/schema';
import {
  DrizzleGameRepository,
  DrizzleGameResultRepository,
  DrizzleGroupRepository,
  DrizzleLeagueRepository,
  DrizzleMatchRepository,
  DrizzlePlayerRepository,
  DrizzleRulesetRepository,
} from '../repositories/drizzle';
import type {
  GameRepository,
  GameResultRepository,
  GroupRepository,
  LeagueRepository,
  MatchRepository,
  PlayerRepository,
  RulesetRepository,
} from '../repositories/interfaces';
import { LeagueService } from '../services/league-service';
import { getRequestDb, requireOwnerId } from './context';
import { getGroupServerStore, seedDevDataIfEmpty } from './groups-store';
import {
  MemoryGameRepository,
  MemoryGameResultRepository,
  MemoryGroupRepository,
  MemoryLeagueRepository,
  MemoryMatchRepository,
  MemoryPlayerRepository,
  MemoryRulesetRepository,
} from './memory-repos';

// ---------------------------------------------------------------------------
// Repository facade
// ---------------------------------------------------------------------------
// Pass the request's Drizzle `db` for the D1 path, or nothing for the
// in-memory path the unit tests drive.

interface ServerRepos {
  service: LeagueService;
  groups: GroupRepository;
  leagues: LeagueRepository;
  rulesets: RulesetRepository;
  matches: MatchRepository;
  games: GameRepository;
  gameResults: GameResultRepository;
  players: PlayerRepository;
}

const makeRepos = (db?: Database): ServerRepos => {
  const built = db
    ? {
        groups: new DrizzleGroupRepository(db),
        leagues: new DrizzleLeagueRepository(db),
        rulesets: new DrizzleRulesetRepository(db),
        matches: new DrizzleMatchRepository(db),
        games: new DrizzleGameRepository(db),
        gameResults: new DrizzleGameResultRepository(db),
        players: new DrizzlePlayerRepository(db),
      }
    : (() => {
        const store = getGroupServerStore();
        return {
          groups: new MemoryGroupRepository(store),
          leagues: new MemoryLeagueRepository(store),
          rulesets: new MemoryRulesetRepository(store),
          matches: new MemoryMatchRepository(store),
          games: new MemoryGameRepository(store),
          gameResults: new MemoryGameResultRepository(store),
          players: new MemoryPlayerRepository(store),
        };
      })();
  return { service: new LeagueService(built.leagues), ...built };
};

// ---------------------------------------------------------------------------
// Input validators
// ---------------------------------------------------------------------------
// `ownerId` is resolved server-side from the session; the `*Input` handler
// types add it back via `WithOwner`.

const listLeaguesInput = z.object({
  /**
   * The Group whose Leagues to list. Required since Issue #60: the list lives
   * at `/groups/:groupId/leagues`, so `groupId` always comes from the URL
   * path. There is no cross-Group fallback — a foreign / unknown id resolves
   * to `null` (the route redirects to `/groups`).
   */
  groupId: z.string().min(1),
});
const leagueDetailInput = z.object({
  /**
   * The Group the detail page is scoped to (from the URL path). The handler
   * verifies the target League actually belongs to this Group so a League id
   * pasted under the wrong Group namespace resolves to `null` rather than
   * silently rendering under a Group it does not belong to.
   */
  groupId: z.string().min(1),
  leagueId: z.string().min(1),
});
const createLeagueInput = z.object({
  groupId: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  format: z.enum(LEAGUE_FORMATS),
  // `null` lets the server fall back to the Group's default Ruleset. A
  // bare `undefined` would be ambiguous (omitted vs. explicit null), so
  // we require an explicit value on the wire.
  defaultRulesetId: z.string().min(1).nullable(),
});

type WithOwner<T> = T & { ownerId: string };

export type ListLeaguesInput = WithOwner<z.infer<typeof listLeaguesInput>>;
export type LeagueDetailInput = WithOwner<z.infer<typeof leagueDetailInput>>;
export type CreateLeagueInput = WithOwner<z.infer<typeof createLeagueInput>>;

// ---------------------------------------------------------------------------
// publicSlug generation
// ---------------------------------------------------------------------------

/**
 * Number of retries when we hit an in-use slug. 5 is overkill at 64 bits of
 * entropy but cheap to declare; it also bounds the worst-case CPU when the
 * RNG is mocked in a test.
 */
export const PUBLIC_SLUG_MAX_RETRIES = 5;

const defaultRandomSlug = (): string => {
  // 16 hex chars = 64 bits of entropy; URL-safe; lowercase looks tidier in
  // the address bar than the full UUID.
  return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 16);
};

/**
 * Returns the next unused slug. Exported for testing — production callers
 * use it transitively through {@link createLeagueHandler}.
 */
export const generatePublicSlug = async (
  leagues: LeagueRepository,
  random: () => string = defaultRandomSlug,
): Promise<string> => {
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
};

// ---------------------------------------------------------------------------
// Projections
// ---------------------------------------------------------------------------

/**
 * Per-League aggregates the list card needs. Pre-computed by the handler from
 * the gathered Match / Game / Player rows so this projection stays pure and
 * storage-agnostic.
 */
interface LeagueListAggregates {
  matchCount: number;
  gameCount: number;
  lastPlayedAt: string | null;
  /**
   * Active Players in the League's Group. GameResult is not used here — for
   * MVP we approximate "participants" as the active roster, which keeps the
   * card honest without overstating activity.
   */
  activePlayerCount: number;
}

const projectListItem = (
  league: League,
  aggregates: LeagueListAggregates,
  groupNameById: ReadonlyMap<string, string>,
): LeagueListItem => {
  const { matchCount, gameCount, lastPlayedAt, activePlayerCount: playerCount } = aggregates;

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
};

const projectRulesetOption = (
  ruleset: Ruleset,
  groupDefaultRulesetId: string | null,
): LeagueRulesetOption => {
  return {
    id: ruleset.id,
    name: ruleset.name,
    startingScore: ruleset.startingScore,
    returnScore: ruleset.returnScore,
    umaPattern: ruleset.umaPattern,
    isGroupDefault: groupDefaultRulesetId === ruleset.id,
  };
};

const compareMatchRows = (a: LeagueMatchRow, b: LeagueMatchRow): number => {
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
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Returns the S15 payload for a single Group: the Group's Leagues plus the
 * create-modal's Group / Ruleset options. The `groupId` is required (it comes
 * from the URL path) — there is no cross-Group fallback.
 *
 * Returns `null` when the Group does not exist or is owned by a different
 * Owner; the route surfaces that as a redirect to `/groups`. Ownership is the
 * server's responsibility: we never trust the path `groupId` on the wire even
 * though the UI only links to the Owner's own Groups.
 *
 * Bundling the modal options into the same response keeps the page on a single
 * round trip — see the comment on {@link LeagueListData}. The Group dropdown
 * collapses to the single scoped Group, so the create form is effectively
 * locked to the Group in the path.
 */
export const listLeaguesHandler = async (
  input: ListLeaguesInput,
  db?: Database,
): Promise<LeagueListData | null> => {
  if (!db) seedDevDataIfEmpty(input.ownerId);
  const repos = makeRepos(db);

  // Ownership guard: the Group must exist and belong to the caller. A foreign
  // / unknown id resolves to `null` (the route redirects to `/groups`).
  const group = await repos.groups.findById(input.groupId);
  if (group === null || group.ownerId !== input.ownerId) return null;

  // Gather Leagues / Matches / Games / Rulesets / Players for the scoped Group
  // through the repositories. Works identically against the in-memory store
  // and D1.
  const [groupLeagues, matches, games, groupRulesets, players] = await Promise.all([
    repos.leagues.listByGroup(group.id),
    repos.matches.listByGroup(group.id),
    repos.games.listByGroup(group.id),
    repos.rulesets.listByGroup(group.id),
    repos.players.listByGroup(group.id),
  ]);

  const activePlayerCount = players.filter((p) => p.isActive).length;
  const groupNameMap = new Map([[group.id, group.name] as const]);
  const items: LeagueListItem[] = [];
  for (const league of groupLeagues) {
    let matchCount = 0;
    for (const m of matches) {
      if (m.leagueId === league.id) matchCount++;
    }
    let gameCount = 0;
    let lastPlayedAt: string | null = null;
    for (const g of games) {
      if (g.leagueId !== league.id) continue;
      gameCount++;
      if (lastPlayedAt === null || g.playedAt > lastPlayedAt) lastPlayedAt = g.playedAt;
    }
    items.push(
      projectListItem(
        league,
        { matchCount, gameCount, lastPlayedAt, activePlayerCount },
        groupNameMap,
      ),
    );
  }

  // Most-recently-active first. Leagues with no Games yet sort behind any
  // League that does have games; among themselves they keep insertion order.
  const leagues = items.sort((a, b) => {
    if (a.lastPlayedAt === null && b.lastPlayedAt === null) return 0;
    if (a.lastPlayedAt === null) return 1;
    if (b.lastPlayedAt === null) return -1;
    return a.lastPlayedAt > b.lastPlayedAt ? -1 : 1;
  });

  // The create modal's Group dropdown collapses to the single scoped Group, so
  // the form is locked to the Group in the path.
  const groups: ReadonlyArray<LeagueGroupOption> = [
    {
      id: group.id,
      name: group.name,
      defaultRulesetId: group.defaultRulesetId,
    },
  ];

  // The scoped Group's Rulesets, tagged with `groupId` so the modal can filter
  // client-side (it only ever sees this one Group's rulesets now).
  const rulesets: LeagueRulesetOptionWithGroup[] = groupRulesets.map((ruleset) => ({
    ...projectRulesetOption(ruleset, group.defaultRulesetId ?? null),
    groupId: ruleset.groupId,
  }));

  return { leagues, groups, rulesets };
};

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
export const getLeagueDetailHandler = async (
  input: LeagueDetailInput,
  db?: Database,
): Promise<LeagueDetailData | null> => {
  if (!db) seedDevDataIfEmpty(input.ownerId);
  const repos = makeRepos(db);

  const league = await repos.leagues.findById(input.leagueId);
  if (league === null) return null;
  // The League must live under the Group in the URL path. A League id pasted
  // under the wrong Group namespace resolves to `null` (the route redirects to
  // that Group's list) rather than rendering under a foreign Group.
  if (league.groupId !== input.groupId) return null;
  const group = await repos.groups.findById(league.groupId);
  if (!group || group.ownerId !== input.ownerId) return null;

  const matches = await repos.matches.listByLeague(league.id);
  const games = await repos.games.listByLeague(league.id);
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
    league.defaultRulesetId === null
      ? null
      : await repos.rulesets.findById(league.defaultRulesetId);
  const groupDefault = group.defaultRulesetId;
  const defaultRuleset: LeagueRulesetOption | null =
    defaultRulesetRow === null ? null : projectRulesetOption(defaultRulesetRow, groupDefault);

  // Ranking is computed from GameResult rows (Issue #19). We gather every
  // GameResult whose Game is part of this League, aggregating per-player
  // totals + topCount / lastCount. The detail screen sorts visually but we
  // also pre-sort here so the response shape is stable.
  const players = await repos.players.listByGroup(group.id);
  const playerNameById = new Map(players.map((p) => [p.id, p.name] as const));

  const gameResultsNested = await Promise.all(games.map((g) => repos.gameResults.listByGame(g.id)));
  const leagueGameResults: GameResult[] = gameResultsNested.flat();

  const lastRank = league.format.startsWith('3P') ? 3 : 4;
  const rankingAcc = new Map<
    string,
    { gameCount: number; totalPoints: number; topCount: number; lastCount: number }
  >();
  for (const result of leagueGameResults) {
    const entry = rankingAcc.get(result.playerId) ?? {
      gameCount: 0,
      totalPoints: 0,
      topCount: 0,
      lastCount: 0,
    };
    entry.gameCount += 1;
    entry.totalPoints += result.points;
    if (result.rank === 1) entry.topCount += 1;
    if (result.rank === lastRank) entry.lastCount += 1;
    rankingAcc.set(result.playerId, entry);
  }
  const ranking: ReadonlyArray<LeagueRankingRow> = [...rankingAcc.entries()]
    .map(
      ([playerId, entry]): LeagueRankingRow => ({
        playerId,
        playerName: playerNameById.get(playerId) ?? '（削除されたプレイヤー）',
        gameCount: entry.gameCount,
        totalPoints: entry.totalPoints,
        averagePoints: entry.gameCount === 0 ? 0 : entry.totalPoints / entry.gameCount,
        topCount: entry.topCount,
        lastCount: entry.lastCount,
      }),
    )
    .sort((a, b) => {
      if (a.totalPoints !== b.totalPoints) return b.totalPoints - a.totalPoints;
      if (a.averagePoints !== b.averagePoints) return b.averagePoints - a.averagePoints;
      return a.playerName.localeCompare(b.playerName);
    });

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
};

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
export const createLeagueHandler = async (
  input: CreateLeagueInput,
  db?: Database,
): Promise<LeagueListItem> => {
  if (!db) seedDevDataIfEmpty(input.ownerId);
  const { groups, rulesets, players, service, leagues } = makeRepos(db);

  const group = await groups.findById(input.groupId);
  if (!group || group.ownerId !== input.ownerId) {
    throw new Error('Group not found or not owned by caller.');
  }

  // Resolve the effective default Ruleset id. Caller may pass null to opt
  // into the Group default; we additionally validate that any explicit id
  // belongs to the same Group (the in-memory dropdown will only surface
  // matching ones, but we re-check defensively).
  let defaultRulesetId: string | null = input.defaultRulesetId;
  if (defaultRulesetId !== null) {
    const ruleset = await rulesets.findById(defaultRulesetId);
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

  // A brand-new League has no Matches / Games yet; only the Group's active
  // roster contributes to the card.
  const groupPlayers = await players.listByGroup(group.id);
  return projectListItem(
    created,
    {
      matchCount: 0,
      gameCount: 0,
      lastPlayedAt: null,
      activePlayerCount: groupPlayers.filter((p) => p.isActive).length,
    },
    new Map([[group.id, group.name] as const]),
  );
};

// ---------------------------------------------------------------------------
// Server function wrappers
// ---------------------------------------------------------------------------

export const listLeaguesServerFn = createServerFn({ method: 'GET' })
  .inputValidator(listLeaguesInput)
  .handler(async ({ data }) =>
    listLeaguesHandler({ ...data, ownerId: await requireOwnerId() }, getRequestDb()),
  );

export const getLeagueDetailServerFn = createServerFn({ method: 'GET' })
  .inputValidator(leagueDetailInput)
  .handler(async ({ data }) =>
    getLeagueDetailHandler({ ...data, ownerId: await requireOwnerId() }, getRequestDb()),
  );

export const createLeagueServerFn = createServerFn({ method: 'POST' })
  .inputValidator(createLeagueInput)
  .handler(async ({ data }) =>
    createLeagueHandler({ ...data, ownerId: await requireOwnerId() }, getRequestDb()),
  );
