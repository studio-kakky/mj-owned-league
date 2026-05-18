/**
 * TanStack Start server functions for the P1-P4 public viewer screens
 * (`04-screens.md` § P1 / P2 / P3 / P4, `03-user-flow.md` § F8, Issue #23).
 *
 * Shape & boundaries — mirrors the Owner-side `server/leagues.ts` and
 * `server/match-detail.ts`:
 *
 *   - Handlers (`getPublicLeagueHandler`, `getPublicLeagueMatchHandler`,
 *     `getPublicMatchHandler`, `getPublicPlayerHandler`) are exported
 *     separately from the `createServerFn` wrappers so unit tests can drive
 *     them directly without bundling the RPC compiler.
 *
 *   - Public functions do **not** take an `ownerId` — that's the whole point
 *     of P1-P4 per `03-user-flow.md` § F8: knowing the slug is the auth
 *     check. The server still applies the same ownership invariants on the
 *     data path (e.g. Match must belong to the same Group as the League
 *     resolved from the slug) so a malicious URL cannot bridge into a
 *     foreign Owner's data.
 *
 *   - Slug lookup is `O(leagues)` for MVP because the in-memory repo has no
 *     index on `publicSlug`; when D1 lands the unique index already declared
 *     in `db/schema.ts` makes this `O(log n)` for free.
 *
 *   - The presentational `<PublicLeagueScreen>` / `<PublicMatchScreen>` /
 *     `<PublicPlayerScreen>` never import this module — the route layer is
 *     the only RPC boundary.
 *
 * Ranking computation:
 *   Identical to the Owner-side calculator in `server/match-detail.ts` and
 *   `server/leagues.ts`. We do not yet expose a shared helper because the
 *   public projection asks for a strictly richer row (averageRank / topRate),
 *   and forcing the Owner side to either compute-and-discard or carry
 *   nullable fields would dilute both APIs. When the D1 swap (#39) lands we
 *   should reconsider extracting a single ranking module.
 *
 * Why P3 returns null:
 *   `02-domain-model.md` § Match does not define a Match-level publicSlug.
 *   `/m/:publicSlug` is therefore reserved for a future Match-only sharing
 *   surface; for now every input resolves to `null` and the route renders
 *   the empty / "URL が無効" state. Adding a Match-level slug is a separate
 *   Issue.
 */

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type {
  PublicLeagueData,
  PublicLeagueMatchRow,
  PublicLeagueRankingRow,
  PublicMatchData,
  PublicMatchGameResultRow,
  PublicMatchGameRow,
  PublicMatchRankingRow,
  PublicPlayerData,
  PublicPlayerGameRow,
  PublicPlayerMatchRow,
  PublicPlayerSummary,
  PublicRulesetSummary,
} from '../components/public/types';
import type {
  Game,
  GameResult,
  Group,
  League,
  LeagueFormat,
  Match,
  Player,
  Ruleset,
} from '../db/schema';
import { type GroupServerStore, getGroupServerStore } from './groups-store';

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

const slugInput = z.object({
  publicSlug: z.string().min(1),
});

const leagueMatchInput = z.object({
  publicSlug: z.string().min(1),
  sequenceNumber: z.number().int().min(1),
});

const leaguePlayerInput = z.object({
  publicSlug: z.string().min(1),
  playerId: z.string().min(1),
});

export type PublicSlugInput = z.infer<typeof slugInput>;
export type PublicLeagueMatchInput = z.infer<typeof leagueMatchInput>;
export type PublicLeaguePlayerInput = z.infer<typeof leaguePlayerInput>;

// ---------------------------------------------------------------------------
// Projection helpers
// ---------------------------------------------------------------------------

const projectGameRow = (
  game: Game,
  gameResults: ReadonlyMap<string, GameResult>,
  playerNameById: ReadonlyMap<string, string>,
  rulesetNameById: ReadonlyMap<string, string>,
): PublicMatchGameRow => {
  const results: PublicMatchGameResultRow[] = [];
  for (const r of gameResults.values()) {
    if (r.gameId !== game.id) continue;
    results.push({
      playerId: r.playerId,
      playerName: playerNameById.get(r.playerId) ?? '（削除されたプレイヤー）',
      rawScore: r.rawScore,
      points: r.points,
      rank: r.rank,
      tobiRole: r.tobiRole,
    });
  }
  results.sort((a, b) => a.rank - b.rank);
  return {
    id: game.id,
    playedAt: game.playedAt,
    rulesetName: rulesetNameById.get(game.rulesetId) ?? '（削除された Ruleset）',
    results,
  };
};

const projectRulesetSummary = (ruleset: Ruleset): PublicRulesetSummary => {
  return {
    name: ruleset.name,
    startingScore: ruleset.startingScore,
    returnScore: ruleset.returnScore,
    umaPattern: ruleset.umaPattern,
    tobiPoint: ruleset.tobiEnabled ? ruleset.tobiPoint : null,
  };
};

const findLeagueBySlug = (store: GroupServerStore, slug: string): League | null => {
  for (const league of store.leagues.values()) {
    if (league.publicSlug === slug) return league;
  }
  return null;
};

const computeLeagueRanking = (
  games: ReadonlyArray<Game>,
  gameResults: ReadonlyMap<string, GameResult>,
  playerNameById: ReadonlyMap<string, string>,
  format: LeagueFormat,
): PublicLeagueRankingRow[] => {
  const lastRank = format.startsWith('3P') ? 3 : 4;
  const leagueGameIds = new Set(games.map((g) => g.id));

  const acc = new Map<
    string,
    {
      gameCount: number;
      totalPoints: number;
      topCount: number;
      lastCount: number;
      rankSum: number;
    }
  >();
  for (const r of gameResults.values()) {
    if (!leagueGameIds.has(r.gameId)) continue;
    const entry = acc.get(r.playerId) ?? {
      gameCount: 0,
      totalPoints: 0,
      topCount: 0,
      lastCount: 0,
      rankSum: 0,
    };
    entry.gameCount += 1;
    entry.totalPoints += r.points;
    entry.rankSum += r.rank;
    if (r.rank === 1) entry.topCount += 1;
    if (r.rank === lastRank) entry.lastCount += 1;
    acc.set(r.playerId, entry);
  }

  const rows: PublicLeagueRankingRow[] = [...acc.entries()].map(([playerId, entry]) => ({
    playerId,
    playerName: playerNameById.get(playerId) ?? '（削除されたプレイヤー）',
    gameCount: entry.gameCount,
    totalPoints: entry.totalPoints,
    averagePoints: entry.gameCount === 0 ? 0 : entry.totalPoints / entry.gameCount,
    topCount: entry.topCount,
    lastCount: entry.lastCount,
    averageRank: entry.gameCount === 0 ? 0 : entry.rankSum / entry.gameCount,
    topRate: entry.gameCount === 0 ? 0 : entry.topCount / entry.gameCount,
  }));

  rows.sort((a, b) => {
    if (a.totalPoints !== b.totalPoints) return b.totalPoints - a.totalPoints;
    if (a.averagePoints !== b.averagePoints) return b.averagePoints - a.averagePoints;
    return a.playerName.localeCompare(b.playerName);
  });

  return rows;
};

const projectMatchPayload = (
  store: GroupServerStore,
  match: Match,
  group: Group,
  league: League | null,
): PublicMatchData => {
  const format: LeagueFormat = league?.format ?? '4P_HANCHAN';

  const groupPlayers = [...store.players.values()].filter((p) => p.groupId === group.id);
  const playerNameById = new Map(groupPlayers.map((p) => [p.id, p.name] as const));
  const groupRulesets = [...store.rulesets.values()].filter((r) => r.groupId === group.id);
  const rulesetNameById = new Map(groupRulesets.map((r) => [r.id, r.name] as const));

  const games = [...store.games.values()].filter((g) => g.matchId === match.id);
  games.sort((a, b) => (a.playedAt > b.playedAt ? -1 : a.playedAt < b.playedAt ? 1 : 0));

  const gameRows: PublicMatchGameRow[] = games.map((g) =>
    projectGameRow(g, store.gameResults, playerNameById, rulesetNameById),
  );

  // Match-internal ranking — totalPoints desc, with the same tie-break order
  // the Owner-side calculator uses for stability.
  const lastRank = format.startsWith('3P') ? 3 : 4;
  const acc = new Map<
    string,
    { gameCount: number; totalPoints: number; topCount: number; lastCount: number }
  >();
  for (const game of gameRows) {
    for (const r of game.results) {
      const entry = acc.get(r.playerId) ?? {
        gameCount: 0,
        totalPoints: 0,
        topCount: 0,
        lastCount: 0,
      };
      entry.gameCount += 1;
      entry.totalPoints += r.points;
      if (r.rank === 1) entry.topCount += 1;
      if (r.rank === lastRank) entry.lastCount += 1;
      acc.set(r.playerId, entry);
    }
  }
  const ranking: PublicMatchRankingRow[] = [...acc.entries()]
    .map(
      ([playerId, entry]): PublicMatchRankingRow => ({
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

  const effectiveRulesetId =
    match.defaultRulesetId ?? league?.defaultRulesetId ?? group.defaultRulesetId ?? null;
  const rulesetRow =
    effectiveRulesetId === null ? null : (store.rulesets.get(effectiveRulesetId) ?? null);

  return {
    name: match.name,
    heldAt: match.heldAt,
    memo: match.memo,
    format,
    groupName: group.name,
    leagueName: league?.name ?? null,
    leaguePublicSlug: league?.publicSlug ?? null,
    sequenceNumber: match.sequenceNumber,
    defaultRuleset: rulesetRow === null ? null : projectRulesetSummary(rulesetRow),
    ranking,
    games: gameRows,
  };
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * P1 — League 公開ページ.
 *
 * Returns the projected payload for the League whose `publicSlug` matches,
 * or `null` for unknown slugs (the route renders a 404-ish empty state).
 */
export const getPublicLeagueHandler = async (
  input: PublicSlugInput,
): Promise<PublicLeagueData | null> => {
  const store = getGroupServerStore();

  const league = findLeagueBySlug(store, input.publicSlug);
  if (league === null) return null;
  const group = store.groups.get(league.groupId);
  if (!group) return null;

  const matches = [...store.matches.values()].filter((m) => m.leagueId === league.id);
  const games = [...store.games.values()].filter((g) => g.leagueId === league.id);
  const groupPlayers = new Map<string, Player>();
  for (const p of store.players.values()) {
    if (p.groupId === group.id) groupPlayers.set(p.id, p);
  }
  const playerNameById = new Map<string, string>(
    [...groupPlayers.values()].map((p) => [p.id, p.name] as const),
  );

  const gameCountByMatch = new Map<string, number>();
  for (const g of games) {
    if (g.matchId === null) continue;
    gameCountByMatch.set(g.matchId, (gameCountByMatch.get(g.matchId) ?? 0) + 1);
  }

  // Surface only matches that have a sequenceNumber — the public route requires
  // it for the per-match URL and "未採番" matches indicate a Match that has
  // not been promoted into the League's running list yet.
  const matchRows: PublicLeagueMatchRow[] = matches
    .filter((m): m is Match & { sequenceNumber: number } => m.sequenceNumber !== null)
    .map(
      (m): PublicLeagueMatchRow => ({
        id: m.id,
        name: m.name,
        sequenceNumber: m.sequenceNumber,
        heldAt: m.heldAt,
        gameCount: gameCountByMatch.get(m.id) ?? 0,
      }),
    )
    // Most-recent 節 first; falls back to heldAt when sequenceNumber ties (shouldn't).
    .sort((a, b) => b.sequenceNumber - a.sequenceNumber);

  const ranking = computeLeagueRanking(games, store.gameResults, playerNameById, league.format);

  const defaultRulesetRow =
    league.defaultRulesetId === null ? null : (store.rulesets.get(league.defaultRulesetId) ?? null);

  return {
    publicSlug: league.publicSlug,
    name: league.name,
    format: league.format,
    groupName: group.name,
    defaultRuleset: defaultRulesetRow === null ? null : projectRulesetSummary(defaultRulesetRow),
    matches: matchRows,
    ranking,
  };
};

/**
 * P2 — Match 公開ページ (League 配下).
 *
 * Looks up the League by slug, then the Match by `(leagueId, sequenceNumber)`.
 * Returns `null` if either resolution fails. The Match's Group must match
 * the League's Group; a mismatch is a data corruption sign, treated as
 * not-found from the viewer's perspective.
 */
export const getPublicLeagueMatchHandler = async (
  input: PublicLeagueMatchInput,
): Promise<PublicMatchData | null> => {
  const store = getGroupServerStore();

  const league = findLeagueBySlug(store, input.publicSlug);
  if (league === null) return null;
  const group = store.groups.get(league.groupId);
  if (!group) return null;

  const match = [...store.matches.values()].find(
    (m) => m.leagueId === league.id && m.sequenceNumber === input.sequenceNumber,
  );
  if (!match) return null;
  if (match.groupId !== group.id) return null;

  return projectMatchPayload(store, match, group, league);
};

/**
 * P3 — Match 公開ページ (League 外).
 *
 * Reserved for a future Match-level publicSlug. `02-domain-model.md` does not
 * yet model one, so every input resolves to `null` today; the route renders
 * the empty / "URL が無効" state. Adding the slug + lookup is a separate
 * Issue — see the file-level comment.
 */
export const getPublicMatchHandler = async (
  _input: PublicSlugInput,
): Promise<PublicMatchData | null> => {
  return null;
};

/**
 * P4 — 個人成績ページ (League 内).
 *
 * Resolves the League by slug, then the Player by id. The Player must belong
 * to the League's Group; cross-Group player ids return `null` so a viewer
 * cannot enumerate players from a neighbouring Group via P4.
 */
export const getPublicPlayerHandler = async (
  input: PublicLeaguePlayerInput,
): Promise<PublicPlayerData | null> => {
  const store = getGroupServerStore();

  const league = findLeagueBySlug(store, input.publicSlug);
  if (league === null) return null;
  const group = store.groups.get(league.groupId);
  if (!group) return null;
  const player = store.players.get(input.playerId);
  if (!player || player.groupId !== group.id) return null;

  const matches = [...store.matches.values()]
    .filter(
      (m): m is Match & { sequenceNumber: number } =>
        m.leagueId === league.id && m.sequenceNumber !== null,
    )
    .sort((a, b) => b.sequenceNumber - a.sequenceNumber);
  const matchById = new Map(matches.map((m) => [m.id, m] as const));
  const games = [...store.games.values()].filter((g) => g.leagueId === league.id);
  const gameById = new Map(games.map((g) => [g.id, g] as const));

  const lastRank = league.format.startsWith('3P') ? 3 : 4;

  // Aggregate per-Match metrics and the personal game history in one pass.
  const matchAcc = new Map<
    string,
    {
      gameCount: number;
      totalPoints: number;
      topCount: number;
      lastCount: number;
    }
  >();
  const gameRows: PublicPlayerGameRow[] = [];
  let totalGameCount = 0;
  let totalPoints = 0;
  let totalRankSum = 0;
  let totalTop = 0;
  let totalLast = 0;

  for (const result of store.gameResults.values()) {
    if (result.playerId !== player.id) continue;
    const game = gameById.get(result.gameId);
    if (!game) continue;
    if (game.matchId === null) continue;
    const match = matchById.get(game.matchId);
    if (!match) continue;

    totalGameCount += 1;
    totalPoints += result.points;
    totalRankSum += result.rank;
    if (result.rank === 1) totalTop += 1;
    if (result.rank === lastRank) totalLast += 1;

    const entry = matchAcc.get(match.id) ?? {
      gameCount: 0,
      totalPoints: 0,
      topCount: 0,
      lastCount: 0,
    };
    entry.gameCount += 1;
    entry.totalPoints += result.points;
    if (result.rank === 1) entry.topCount += 1;
    if (result.rank === lastRank) entry.lastCount += 1;
    matchAcc.set(match.id, entry);

    gameRows.push({
      gameId: game.id,
      matchId: match.id,
      matchName: match.name,
      matchSequenceNumber: match.sequenceNumber,
      playedAt: game.playedAt,
      rawScore: result.rawScore,
      points: result.points,
      rank: result.rank,
      tobiRole: result.tobiRole,
    });
  }

  gameRows.sort((a, b) => (a.playedAt > b.playedAt ? -1 : a.playedAt < b.playedAt ? 1 : 0));

  const matchRows: PublicPlayerMatchRow[] = matches.map((m) => {
    const entry = matchAcc.get(m.id);
    return {
      matchId: m.id,
      matchName: m.name,
      sequenceNumber: m.sequenceNumber,
      heldAt: m.heldAt,
      gameCount: entry?.gameCount ?? 0,
      totalPoints: entry?.totalPoints ?? 0,
      averagePoints:
        entry === undefined || entry.gameCount === 0 ? 0 : entry.totalPoints / entry.gameCount,
      topCount: entry?.topCount ?? 0,
      lastCount: entry?.lastCount ?? 0,
    };
  });

  const summary: PublicPlayerSummary = {
    gameCount: totalGameCount,
    totalPoints,
    averagePoints: totalGameCount === 0 ? 0 : totalPoints / totalGameCount,
    topCount: totalTop,
    lastCount: totalLast,
    topRate: totalGameCount === 0 ? 0 : totalTop / totalGameCount,
    averageRank: totalGameCount === 0 ? 0 : totalRankSum / totalGameCount,
  };

  return {
    playerId: player.id,
    playerName: player.name,
    leagueName: league.name,
    leaguePublicSlug: league.publicSlug,
    format: league.format,
    summary,
    matches: matchRows,
    games: gameRows,
  };
};

// ---------------------------------------------------------------------------
// Server function wrappers
// ---------------------------------------------------------------------------

export const getPublicLeagueServerFn = createServerFn({ method: 'GET' })
  .inputValidator(slugInput)
  .handler(({ data }) => getPublicLeagueHandler(data));

export const getPublicLeagueMatchServerFn = createServerFn({ method: 'GET' })
  .inputValidator(leagueMatchInput)
  .handler(({ data }) => getPublicLeagueMatchHandler(data));

export const getPublicMatchServerFn = createServerFn({ method: 'GET' })
  .inputValidator(slugInput)
  .handler(({ data }) => getPublicMatchHandler(data));

export const getPublicPlayerServerFn = createServerFn({ method: 'GET' })
  .inputValidator(leaguePlayerInput)
  .handler(({ data }) => getPublicPlayerHandler(data));
