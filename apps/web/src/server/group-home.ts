/**
 * TanStack Start server function for the S6 Group 詳細 (ホーム) screen
 * (`04-screens.md` § S6, Issue #16).
 *
 * Shape & boundaries — mirrors `server/dashboard.ts` (Issue #14) and
 * `server/leagues.ts` (Issue #18):
 *
 *   - The handler is exported separately from the `createServerFn` wrapper
 *     so unit tests can drive it without bundling the RPC compiler.
 *
 *   - The route layer (`routes/_owner/groups.$groupId.tsx`) is the only
 *     place that crosses the RPC boundary; the presentational
 *     {@link GroupHomeScreen} never imports this module.
 *
 *   - The handler reads the shared in-memory store (`getGroupServerStore`)
 *     so writes from other screens are visible. When the D1 binding
 *     becomes reachable from server functions (#39) the `makeRepos`
 *     accessor is the only place that needs to change — same one-file
 *     swap pattern the other server modules use.
 *
 * Ranking computation:
 *   We aggregate every `GameResult` row whose `Game` belongs to the target
 *   Group. The points + rank fields on each row are the authoritative
 *   values written by `submitGameHandler` via the domain scoring pipeline
 *   (`calculateGamePoints` / `rankWithUma`, both from Issue #10). The home
 *   screen therefore inherits the same calculator without re-running it —
 *   re-deriving from `rawScore` would risk drift between displayed and
 *   stored values. The ranking is sorted `totalPoints` desc with
 *   `averagePoints` desc as a tiebreaker, then `playerName` for stability.
 *
 * Owner-scoped reads:
 *   The handler returns `null` when the target Group does not exist or is
 *   owned by a different Owner. The route surfaces `null` as a redirect to
 *   `/groups`, matching the S7 League detail recovery path. Cross-Group
 *   reads are not possible — every projection below is bounded by
 *   `match.groupId === input.groupId`.
 */

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  GROUP_HOME_LEAGUES_LIMIT,
  GROUP_HOME_MATCHES_LIMIT,
  GROUP_HOME_RECENT_GAMES_LIMIT,
  type GroupHomeData,
  type GroupHomeLeagueRow,
  type GroupHomeMatchRow,
  type GroupHomeRankingRow,
  type GroupHomeRecentGameRow,
} from '../components/group-home';
import type { Game, League, Match } from '../db/schema';
import { getGroupServerStore, seedDevDataIfEmpty } from './groups-store';

const groupHomeInput = z.object({
  ownerId: z.string().min(1),
  groupId: z.string().min(1),
});

export type GroupHomeInput = z.infer<typeof groupHomeInput>;

/**
 * Builds the {@link GroupHomeData} payload for the target Group, or returns
 * `null` when the Group does not exist / is not owned by the caller.
 *
 * Steps, in order:
 *   1. Look up the Group and assert Owner match.
 *   2. Collect every League / Match / Game / GameResult belonging to the
 *      Group with a single pass over each Map.
 *   3. Project each section, trimming the long sections to the matching
 *      `GROUP_HOME_*_LIMIT` constant.
 *   4. Aggregate the GameResult rows into the Group-wide ranking.
 */
export async function groupHomeHandler(input: GroupHomeInput): Promise<GroupHomeData | null> {
  seedDevDataIfEmpty(input.ownerId);
  const store = getGroupServerStore();

  const group = store.groups.get(input.groupId);
  if (!group || group.ownerId !== input.ownerId) return null;

  // Filter every relevant entity to the Group in single passes. The store is
  // small enough that scanning the Maps is cheap; with D1 these become four
  // `WHERE group_id = ?` queries that run in parallel.
  const leagues: League[] = [];
  for (const l of store.leagues.values()) {
    if (l.groupId === group.id) leagues.push(l);
  }
  const matches: Match[] = [];
  for (const m of store.matches.values()) {
    if (m.groupId === group.id) matches.push(m);
  }
  const games: Game[] = [];
  for (const g of store.games.values()) {
    if (g.groupId === group.id) games.push(g);
  }

  // Active-player count for the header pill. The schema-defined
  // `isActive` flag is the source of truth — inactive players still appear
  // in the ranking (their historical results are part of the Group's
  // story) but don't contribute to the headline number.
  let activePlayerCount = 0;
  for (const p of store.players.values()) {
    if (p.groupId !== group.id) continue;
    if (!p.isActive) continue;
    activePlayerCount += 1;
  }

  // Lookup maps for the projections below.
  const leagueNameById = new Map(leagues.map((l) => [l.id, l.name] as const));
  const matchNameById = new Map(matches.map((m) => [m.id, m.name] as const));
  const playerNameById = new Map<string, string>();
  for (const p of store.players.values()) {
    if (p.groupId === group.id) playerNameById.set(p.id, p.name);
  }

  // Game count + last-played per League + per-Match (single pass over games).
  const matchGameCounts = new Map<string, number>();
  const leagueGameCounts = new Map<string, number>();
  const leagueLastPlayedAt = new Map<string, string>();
  let lastPlayedAt: string | null = null;
  for (const g of games) {
    if (g.matchId !== null) {
      matchGameCounts.set(g.matchId, (matchGameCounts.get(g.matchId) ?? 0) + 1);
    }
    if (g.leagueId !== null) {
      leagueGameCounts.set(g.leagueId, (leagueGameCounts.get(g.leagueId) ?? 0) + 1);
      const prev = leagueLastPlayedAt.get(g.leagueId);
      if (prev === undefined || g.playedAt > prev) {
        leagueLastPlayedAt.set(g.leagueId, g.playedAt);
      }
    }
    if (lastPlayedAt === null || g.playedAt > lastPlayedAt) {
      lastPlayedAt = g.playedAt;
    }
  }

  const leagueMatchCounts = new Map<string, number>();
  for (const m of matches) {
    if (m.leagueId !== null) {
      leagueMatchCounts.set(m.leagueId, (leagueMatchCounts.get(m.leagueId) ?? 0) + 1);
    }
  }

  return {
    id: group.id,
    name: group.name,
    createdAt: group.createdAt,
    activePlayerCount,
    totalGameCount: games.length,
    lastPlayedAt,

    leagues: projectLeagues(leagues, leagueMatchCounts, leagueGameCounts, leagueLastPlayedAt),
    matches: projectMatches(matches, matchGameCounts, leagueNameById),
    ranking: projectRanking(group.id, games, store, playerNameById),
    recentGames: projectRecentGames(games, matchNameById, leagueNameById),
  };
}

export const getGroupHomeServerFn = createServerFn({ method: 'GET' })
  .inputValidator(groupHomeInput)
  .handler(({ data }) => groupHomeHandler(data));

// ---------------------------------------------------------------------------
// Projections — kept as small top-level functions so each one is
// independently testable. Each returns the trimmed display shape ready for
// the screen.
// ---------------------------------------------------------------------------

function projectLeagues(
  leagues: ReadonlyArray<League>,
  matchCountByLeague: ReadonlyMap<string, number>,
  gameCountByLeague: ReadonlyMap<string, number>,
  lastPlayedAtByLeague: ReadonlyMap<string, string>,
): ReadonlyArray<GroupHomeLeagueRow> {
  const rows: GroupHomeLeagueRow[] = leagues.map(
    (l): GroupHomeLeagueRow => ({
      id: l.id,
      name: l.name,
      matchCount: matchCountByLeague.get(l.id) ?? 0,
      gameCount: gameCountByLeague.get(l.id) ?? 0,
      lastPlayedAt: lastPlayedAtByLeague.get(l.id) ?? null,
    }),
  );
  // Most-recently-active first. Leagues with no games sort behind any
  // League that does; among themselves they keep insertion order.
  rows.sort((a, b) => {
    if (a.lastPlayedAt === null && b.lastPlayedAt === null) return 0;
    if (a.lastPlayedAt === null) return 1;
    if (b.lastPlayedAt === null) return -1;
    return a.lastPlayedAt > b.lastPlayedAt ? -1 : 1;
  });
  return rows.slice(0, GROUP_HOME_LEAGUES_LIMIT);
}

function projectMatches(
  matches: ReadonlyArray<Match>,
  gameCountByMatch: ReadonlyMap<string, number>,
  leagueNameById: ReadonlyMap<string, string>,
): ReadonlyArray<GroupHomeMatchRow> {
  const rows: GroupHomeMatchRow[] = matches.map(
    (m): GroupHomeMatchRow => ({
      id: m.id,
      leagueId: m.leagueId,
      leagueName: m.leagueId === null ? null : (leagueNameById.get(m.leagueId) ?? null),
      name: m.name,
      sequenceNumber: m.sequenceNumber,
      heldAt: m.heldAt,
      gameCount: gameCountByMatch.get(m.id) ?? 0,
    }),
  );
  // heldAt desc; undated matches trail. Mirrors the S9 cross-group sort.
  rows.sort((a, b) => {
    if (a.heldAt !== null && b.heldAt !== null) {
      return a.heldAt > b.heldAt ? -1 : a.heldAt < b.heldAt ? 1 : 0;
    }
    if (a.heldAt !== null) return -1;
    if (b.heldAt !== null) return 1;
    return 0;
  });
  return rows.slice(0, GROUP_HOME_MATCHES_LIMIT);
}

function projectRanking(
  groupId: string,
  games: ReadonlyArray<Game>,
  store: ReturnType<typeof getGroupServerStore>,
  playerNameById: ReadonlyMap<string, string>,
): ReadonlyArray<GroupHomeRankingRow> {
  // Find this Group's GameResult rows. We iterate `store.gameResults` once
  // and filter against the set of game ids built above to keep the cost
  // proportional to the result count, not the cross-product.
  //
  // `lastRank` varies per Game (3 for 3P games, 4 for 4P) so we look it up
  // per row via the parent Game's `format`. Most Groups only use one
  // format, but mixing is allowed by the schema.
  const gameFormatById = new Map<string, string>();
  for (const g of games) gameFormatById.set(g.id, g.format);

  const acc = new Map<
    string,
    { gameCount: number; totalPoints: number; topCount: number; lastCount: number }
  >();
  for (const result of store.gameResults.values()) {
    const format = gameFormatById.get(result.gameId);
    if (format === undefined) continue; // not in this Group
    const entry = acc.get(result.playerId) ?? {
      gameCount: 0,
      totalPoints: 0,
      topCount: 0,
      lastCount: 0,
    };
    entry.gameCount += 1;
    entry.totalPoints += result.points;
    if (result.rank === 1) entry.topCount += 1;
    const lastRank = format.startsWith('3P') ? 3 : 4;
    if (result.rank === lastRank) entry.lastCount += 1;
    acc.set(result.playerId, entry);
  }

  const rows: GroupHomeRankingRow[] = [...acc.entries()].map(
    ([playerId, entry]): GroupHomeRankingRow => ({
      playerId,
      playerName: playerNameById.get(playerId) ?? '（削除されたプレイヤー）',
      gameCount: entry.gameCount,
      totalPoints: entry.totalPoints,
      averagePoints: entry.gameCount === 0 ? 0 : entry.totalPoints / entry.gameCount,
      topCount: entry.topCount,
      lastCount: entry.lastCount,
    }),
  );
  rows.sort((a, b) => {
    if (a.totalPoints !== b.totalPoints) return b.totalPoints - a.totalPoints;
    if (a.averagePoints !== b.averagePoints) return b.averagePoints - a.averagePoints;
    return a.playerName.localeCompare(b.playerName);
  });
  // Suppress the unused-binding warning the linter would raise for groupId.
  // The argument exists so callers spell their intent ("ranking *for this
  // Group*") and so future per-Group filtering (e.g. exclude inactive
  // players) has a stable hook.
  void groupId;
  return rows;
}

function projectRecentGames(
  games: ReadonlyArray<Game>,
  matchNameById: ReadonlyMap<string, string>,
  leagueNameById: ReadonlyMap<string, string>,
): ReadonlyArray<GroupHomeRecentGameRow> {
  return games
    .slice()
    .sort((a, b) => (a.playedAt > b.playedAt ? -1 : a.playedAt < b.playedAt ? 1 : 0))
    .slice(0, GROUP_HOME_RECENT_GAMES_LIMIT)
    .map(
      (g): GroupHomeRecentGameRow => ({
        id: g.id,
        matchId: g.matchId,
        matchName: g.matchId === null ? null : (matchNameById.get(g.matchId) ?? null),
        leagueId: g.leagueId,
        leagueName: g.leagueId === null ? null : (leagueNameById.get(g.leagueId) ?? null),
        playedAt: g.playedAt,
      }),
    );
}
