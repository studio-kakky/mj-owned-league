/**
 * Types used by the S3 Owner ダッシュボード (`04-screens.md` § S3, Issue #14).
 *
 * The dashboard does not own any persistence-layer concept of its own — it is
 * a read-only projection composed from the existing entities (Group, League,
 * Match, Game, Invitation). These shapes are kept narrow on purpose so the
 * route loader stays a simple shape-mapping step, and so swapping the
 * in-memory store for D1 later does not touch the screen.
 *
 * All timestamps are ISO 8601 strings; the screen formats them to
 * `YYYY/MM/DD` for display. We surface `null` rather than empty string to
 * make "未対局" / "未開催" cases easy to spot.
 */

/**
 * Card-style projection of a Group on the dashboard.
 *
 * Mirrors {@link GroupListItem} from `components/groups/types.ts` so the
 * formatter helpers in `DashboardScreen` could be lifted across screens if
 * that gets repetitive. Kept as a separate type because the S3 card may
 * grow additional metrics (active-league count, win rate, …) that the S4
 * list does not need.
 */
export interface DashboardGroupCard {
  id: string;
  name: string;
  playerCount: number;
  /** `null` when the Group has no Games yet. */
  lastPlayedAt: string | null;
}

/**
 * One row in the "active leagues" summary list.
 *
 * `matchCount` and `gameCount` are pre-aggregated so the screen never needs
 * to count children client-side. `lastPlayedAt` is the most recent Game
 * `playedAt` within this League — `null` when the League has no Games yet.
 */
export interface DashboardActiveLeague {
  id: string;
  groupId: string;
  groupName: string;
  name: string;
  matchCount: number;
  gameCount: number;
  lastPlayedAt: string | null;
}

/**
 * One row in the "active matches" summary list.
 *
 * Matches are eligible when at least one of:
 *   - `heldAt` is in the future / today,
 *   - the Match has no Games yet,
 *   - the Match was created in the last 30 days.
 *
 * The exact predicate lives in the server function so the screen does not
 * need to know about wall-clock filtering rules.
 */
export interface DashboardActiveMatch {
  id: string;
  groupId: string;
  groupName: string;
  /** `null` for League-外 (standalone) Matches. */
  leagueId: string | null;
  leagueName: string | null;
  name: string;
  /** ISO date `YYYY-MM-DD`, or `null` when the Match has no scheduled date. */
  heldAt: string | null;
  gameCount: number;
}

/**
 * One row in the "recent games" feed.
 *
 * `playedAt` is the canonical sort key; the server returns rows sorted by
 * it descending and trimmed to {@link DASHBOARD_RECENT_LIMIT}.
 */
export interface DashboardRecentGame {
  id: string;
  groupId: string;
  groupName: string;
  matchId: string | null;
  matchName: string | null;
  leagueId: string | null;
  leagueName: string | null;
  playedAt: string;
}

/**
 * Top-level payload the S3 loader hands to {@link DashboardScreen}.
 *
 * `pendingInvitationCount` is just a number — the dashboard surfaces only
 * the count and a link to S14 (招待管理), per `04-screens.md` § S3 表示要素.
 * The actual list lives on S14.
 */
export interface DashboardData {
  groups: ReadonlyArray<DashboardGroupCard>;
  activeLeagues: ReadonlyArray<DashboardActiveLeague>;
  activeMatches: ReadonlyArray<DashboardActiveMatch>;
  recentGames: ReadonlyArray<DashboardRecentGame>;
  pendingInvitationCount: number;
}

/**
 * Maximum row count for each list section on the dashboard. Exported so the
 * server function and the unit tests share the same constant — bumping it is
 * a one-line change.
 */
export const DASHBOARD_RECENT_LIMIT = 5;
