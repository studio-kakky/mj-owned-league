/**
 * TanStack Start server function for the S3 Owner ダッシュボード
 * (`04-screens.md` § S3, Issue #14).
 *
 * Shape & boundaries — mirrors `server/groups.ts` (Issue #15):
 *   - The handler is exported separately from the `createServerFn` wrapper so
 *     unit tests can exercise it without bundling the RPC compiler.
 *   - The route loader is the only place that crosses the RPC boundary; the
 *     screen component (`DashboardScreen`) is purely presentational.
 *   - The handler reads the same in-memory store used by `/groups`
 *     (`getGroupServerStore`). When the TanStack Start ↔ Workers D1 binding
 *     lands (#39), only the repository instantiation inside this file has to
 *     change — the projection logic below stays put.
 *
 * Why no mutations:
 *   The dashboard is read-only by spec (`04-screens.md` § S3 主な操作 lists
 *   only navigation transitions, not edits). Every editable action lives on
 *   the destination screen (S4 / S15 / S9 / S14).
 *
 * Owner-scoped reads:
 *   Like `listGroupsHandler`, we filter every list by `ownerId` so cross-owner
 *   reads never happen even if the client tampers with the request. When
 *   server-side session reads become possible the `ownerId` parameter is
 *   removed in favour of reading from the session — call-site signature stays
 *   the same because the route file owns the conversion.
 */

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  DASHBOARD_RECENT_LIMIT,
  type DashboardActiveLeague,
  type DashboardActiveMatch,
  type DashboardData,
  type DashboardGroupCard,
  type DashboardRecentGame,
} from '../components/dashboard';
import type { Game, Group, Invitation, League, Match } from '../db/schema';
import { getGroupServerStore, seedDevDataIfEmpty } from './groups-store';

const dashboardInput = z.object({ ownerId: z.string().min(1) });
export type DashboardInput = z.infer<typeof dashboardInput>;

/**
 * Override hooks for tests. Exported so the test file can pin the clock
 * without monkey-patching `Date`. Production callers should not pass these.
 */
export interface DashboardHandlerDeps {
  /**
   * Wall-clock source used by the "active match" predicate. Defaults to
   * `new Date()`.
   */
  now?: () => Date;
}

/**
 * Window (ms) for considering a Match "recently created" and therefore
 * still active even without games or a future `heldAt`. 30 days is a
 * conservative choice; the spec does not pin a number, and the dashboard
 * needs *some* upper bound or it will fill up with stale Matches that
 * were created and never used.
 */
export const DASHBOARD_RECENT_MATCH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Projections — kept as small top-level functions so they read top-to-bottom
// and each one is independently testable.
// ---------------------------------------------------------------------------

const projectGroupCards = (
  groups: ReadonlyArray<Group>,
  games: ReadonlyArray<Game>,
  playersByGroup: ReadonlyMap<string, number>,
): ReadonlyArray<DashboardGroupCard> => {
  return groups.map((group): DashboardGroupCard => {
    let lastPlayedAt: string | null = null;
    for (const game of games) {
      if (game.groupId !== group.id) continue;
      if (lastPlayedAt === null || game.playedAt > lastPlayedAt) {
        lastPlayedAt = game.playedAt;
      }
    }
    return {
      id: group.id,
      name: group.name,
      playerCount: playersByGroup.get(group.id) ?? 0,
      lastPlayedAt,
    };
  });
};

const projectActiveLeagues = (
  leagues: ReadonlyArray<League>,
  matches: ReadonlyArray<Match>,
  games: ReadonlyArray<Game>,
  groupNameById: ReadonlyMap<string, string>,
): ReadonlyArray<DashboardActiveLeague> => {
  const rows = leagues.map((league): DashboardActiveLeague => {
    let matchCount = 0;
    for (const m of matches) {
      if (m.leagueId === league.id) matchCount++;
    }
    let gameCount = 0;
    let lastPlayedAt: string | null = null;
    for (const g of games) {
      if (g.leagueId !== league.id) continue;
      gameCount++;
      if (lastPlayedAt === null || g.playedAt > lastPlayedAt) {
        lastPlayedAt = g.playedAt;
      }
    }
    return {
      id: league.id,
      groupId: league.groupId,
      groupName: groupNameById.get(league.groupId) ?? '',
      name: league.name,
      matchCount,
      gameCount,
      lastPlayedAt,
    };
  });

  // Most-recently-active leagues first. Leagues with no Games yet (= null
  // `lastPlayedAt`) sort behind any league that *does* have games; among
  // themselves they are kept in the order the repository returned them.
  // `.slice()` then `.sort()` keeps the function pure — never mutating
  // `rows`. (We deliberately avoid `Array.prototype.toSorted`: the tsconfig
  // lib target does not yet expose it.)
  return rows
    .slice()
    .sort((a, b) => {
      if (a.lastPlayedAt === null && b.lastPlayedAt === null) return 0;
      if (a.lastPlayedAt === null) return 1;
      if (b.lastPlayedAt === null) return -1;
      return a.lastPlayedAt > b.lastPlayedAt ? -1 : 1;
    })
    .slice(0, DASHBOARD_RECENT_LIMIT);
};

const isActiveMatch = (
  match: Match,
  gameCountByMatch: ReadonlyMap<string, number>,
  todayIso: string,
  recentWindowStartMs: number,
): boolean => {
  // Match with a future-or-today heldAt is active.
  if (match.heldAt !== null && match.heldAt >= todayIso) return true;
  // Match without games yet is active regardless of date (likely a draft).
  if ((gameCountByMatch.get(match.id) ?? 0) === 0) return true;
  // Otherwise treat "recently created" as active. createdAt is ISO 8601
  // text; Date.parse handles both `YYYY-MM-DD` and full timestamps.
  const createdAtMs = Date.parse(match.createdAt);
  if (!Number.isNaN(createdAtMs) && createdAtMs >= recentWindowStartMs) return true;
  return false;
};

const projectActiveMatches = (
  matches: ReadonlyArray<Match>,
  games: ReadonlyArray<Game>,
  groupNameById: ReadonlyMap<string, string>,
  leagueNameById: ReadonlyMap<string, string>,
  nowMs: number,
): ReadonlyArray<DashboardActiveMatch> => {
  const gameCountByMatch = new Map<string, number>();
  for (const g of games) {
    if (g.matchId === null) continue;
    gameCountByMatch.set(g.matchId, (gameCountByMatch.get(g.matchId) ?? 0) + 1);
  }

  const todayIso = new Date(nowMs).toISOString().slice(0, 10);
  const recentWindowStartMs = nowMs - DASHBOARD_RECENT_MATCH_WINDOW_MS;

  const rows = matches
    .filter((match) => isActiveMatch(match, gameCountByMatch, todayIso, recentWindowStartMs))
    .map(
      (match): DashboardActiveMatch => ({
        id: match.id,
        groupId: match.groupId,
        groupName: groupNameById.get(match.groupId) ?? '',
        leagueId: match.leagueId,
        leagueName: match.leagueId === null ? null : (leagueNameById.get(match.leagueId) ?? null),
        name: match.name,
        heldAt: match.heldAt,
        gameCount: gameCountByMatch.get(match.id) ?? 0,
      }),
    );

  // Sort: scheduled `heldAt` first (most recent / soonest at the top), then
  // matches with no date (= drafts) trailing. We approximate "soonest" by
  // string comparison since both sides are ISO YYYY-MM-DD. `.slice()` keeps
  // the input array unmutated.
  return rows
    .slice()
    .sort((a, b) => {
      if (a.heldAt !== null && b.heldAt !== null) {
        return a.heldAt > b.heldAt ? -1 : a.heldAt < b.heldAt ? 1 : 0;
      }
      if (a.heldAt !== null) return -1;
      if (b.heldAt !== null) return 1;
      return 0;
    })
    .slice(0, DASHBOARD_RECENT_LIMIT);
};

const projectRecentGames = (
  games: ReadonlyArray<Game>,
  groupNameById: ReadonlyMap<string, string>,
  leagueNameById: ReadonlyMap<string, string>,
  matches: ReadonlyArray<Match>,
): ReadonlyArray<DashboardRecentGame> => {
  const matchNameById = new Map(matches.map((m) => [m.id, m.name] as const));

  return games
    .slice()
    .sort((a, b) => (a.playedAt > b.playedAt ? -1 : a.playedAt < b.playedAt ? 1 : 0))
    .slice(0, DASHBOARD_RECENT_LIMIT)
    .map(
      (game): DashboardRecentGame => ({
        id: game.id,
        groupId: game.groupId,
        groupName: groupNameById.get(game.groupId) ?? '',
        matchId: game.matchId,
        matchName: game.matchId === null ? null : (matchNameById.get(game.matchId) ?? null),
        leagueId: game.leagueId,
        leagueName: game.leagueId === null ? null : (leagueNameById.get(game.leagueId) ?? null),
        playedAt: game.playedAt,
      }),
    );
};

const countPendingInvitations = (
  invitations: ReadonlyMap<string, Invitation>,
  ownerId: string,
  nowMs: number,
): number => {
  let count = 0;
  for (const inv of invitations.values()) {
    if (inv.issuedByOwnerId !== ownerId) continue;
    if (inv.status !== 'PENDING') continue;
    // Treat expired tokens as "no longer usable" so the count matches what
    // S14 would consider actionable. Malformed dates are conservatively
    // counted as expired (= not surfaced).
    const expiresAtMs = Date.parse(inv.expiresAt);
    if (Number.isNaN(expiresAtMs) || expiresAtMs <= nowMs) continue;
    count++;
  }
  return count;
};

/**
 * Builds the {@link DashboardData} payload for a single Owner.
 *
 * Steps, in order:
 *   1. List the Owner's Groups.
 *   2. Pull every Game / League / Match / Invitation that belongs to those
 *      Groups (the in-memory store is small enough that scanning is cheap;
 *      with D1 this becomes one `WHERE owner_id IN (...)` per table).
 *   3. Project each section into its display shape, trimming the long
 *      sections to {@link DASHBOARD_RECENT_LIMIT}.
 *   4. Count PENDING invitations (status filter + expiry filter).
 */
export const dashboardHandler = async (
  input: DashboardInput,
  deps: DashboardHandlerDeps = {},
): Promise<DashboardData> => {
  const now = deps.now ?? (() => new Date());
  const nowMs = now().getTime();

  // Materialise the dev seed on the first call per owner — same hook the
  // `/groups` handler uses. Calling it from both places is safe because the
  // seed is gated by `seededOwnerIds.has(ownerId)`.
  seedDevDataIfEmpty(input.ownerId);

  const store = getGroupServerStore();

  const groups = [...store.groups.values()].filter((g) => g.ownerId === input.ownerId);
  const groupIds = new Set(groups.map((g) => g.id));
  const groupNameById = new Map(groups.map((g) => [g.id, g.name] as const));

  const games = [...store.games.values()].filter((g) => groupIds.has(g.groupId));
  const leagues = [...store.leagues.values()].filter((l) => groupIds.has(l.groupId));
  const leagueNameById = new Map(leagues.map((l) => [l.id, l.name] as const));
  const matches = [...store.matches.values()].filter((m) => groupIds.has(m.groupId));

  // Player counts per group for the group cards. Filtering `isActive` here is
  // intentional — the S3 spec says "Group のメンバー数" which we read as the
  // currently-active roster, not historical.
  const playersByGroup = new Map<string, number>();
  for (const player of store.players.values()) {
    if (!groupIds.has(player.groupId)) continue;
    if (!player.isActive) continue;
    playersByGroup.set(player.groupId, (playersByGroup.get(player.groupId) ?? 0) + 1);
  }

  return {
    groups: projectGroupCards(groups, games, playersByGroup),
    activeLeagues: projectActiveLeagues(leagues, matches, games, groupNameById),
    activeMatches: projectActiveMatches(matches, games, groupNameById, leagueNameById, nowMs),
    recentGames: projectRecentGames(games, groupNameById, leagueNameById, matches),
    pendingInvitationCount: countPendingInvitations(store.invitations, input.ownerId, nowMs),
  };
};

export const getDashboardServerFn = createServerFn({ method: 'GET' })
  .inputValidator(dashboardInput)
  .handler(({ data }) => dashboardHandler(data));
