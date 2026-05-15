/**
 * Types used by the S6 Group 詳細 (ホーム) screen (`04-screens.md` § S6,
 * Issue #16).
 *
 * Boundary rule mirrors `components/dashboard/types.ts` and
 * `components/leagues/types.ts`: schema-layer rows (`Group`, `League`,
 * `Match`, `Game`, `GameResult`, …) carry persistence concerns the screen
 * never needs, so we project narrower display shapes here. The route loader
 * owns the projection; the screen never imports Drizzle.
 *
 * Why this is not just a `DashboardData` scoped to one Group:
 *   - S6 needs a per-Group ranking (Group 通算成績) that aggregates every
 *     `GameResult` under the Group. The dashboard caps the recent-games feed
 *     and never computes a ranking.
 *   - S6 surfaces "ヘッダー的な" Group metadata (active player count, total
 *     game count) that the dashboard's `DashboardGroupCard` does not carry.
 *   Keeping the two shapes separate means each loader stays focused and the
 *   eventual D1 swap (#39) only touches one query per screen.
 */

/**
 * Top-level payload the S6 loader hands to {@link GroupHomeScreen}.
 *
 * `null` is returned by the server when the requested Group does not exist
 * or belongs to a different Owner. The route surfaces that as a redirect to
 * `/groups` rather than throwing — same convention as S7 League detail.
 */
export interface GroupHomeData {
  id: string;
  name: string;
  /** ISO 8601 timestamp; surfaced as "作成日 YYYY/MM/DD" in the header. */
  createdAt: string;
  /** Active players in this Group — drives the "プレイヤー X 人" pill. */
  activePlayerCount: number;
  /** Total persisted Games in this Group (includes League 外). */
  totalGameCount: number;
  /** ISO timestamp of the most recent Game `playedAt`; `null` for no games. */
  lastPlayedAt: string | null;

  leagues: ReadonlyArray<GroupHomeLeagueRow>;
  matches: ReadonlyArray<GroupHomeMatchRow>;
  ranking: ReadonlyArray<GroupHomeRankingRow>;
  recentGames: ReadonlyArray<GroupHomeRecentGameRow>;
}

/**
 * One row in the S6 リーグ section. Pre-aggregated server-side so the
 * screen never has to count children. Sorted most-recently-active first
 * (Leagues with no Games sort last).
 */
export interface GroupHomeLeagueRow {
  id: string;
  name: string;
  matchCount: number;
  gameCount: number;
  /** ISO 8601 timestamp of the most recent Game in this League; `null`. */
  lastPlayedAt: string | null;
}

/**
 * One row in the S6 マッチ履歴 section. Mirrors {@link MatchListItem} but
 * narrower — the per-Group view never crosses Groups so `groupName` is
 * dropped.
 */
export interface GroupHomeMatchRow {
  id: string;
  /** `null` for League 外 (standalone) Matches. */
  leagueId: string | null;
  leagueName: string | null;
  name: string;
  /** Auto-allocated for League 配下 Matches; `null` for standalone. */
  sequenceNumber: number | null;
  /** ISO `YYYY-MM-DD`, or `null` when the Match has no scheduled date. */
  heldAt: string | null;
  gameCount: number;
}

/**
 * One row in the S6 ランキング section. Aggregated from every `GameResult`
 * under the Group, regardless of which League / Match the Game belonged
 * to. Sort key = `totalPoints` desc with `averagePoints` desc as tiebreaker.
 *
 * `playerName` is snapshotted at projection time so historical rankings stay
 * readable even after a Player is renamed / deactivated. Inactive Players
 * still appear in the ranking (their past results are part of Group history)
 * — the screen does not filter them out.
 */
export interface GroupHomeRankingRow {
  playerId: string;
  playerName: string;
  gameCount: number;
  totalPoints: number;
  averagePoints: number;
  /** Count of `rank === 1` finishes. */
  topCount: number;
  /** Count of `rank === N` (last place) finishes; N is 3 or 4 per Game. */
  lastCount: number;
}

/**
 * One row in the S6 直近の対局 feed. Capped server-side at
 * {@link GROUP_HOME_RECENT_GAMES_LIMIT}.
 */
export interface GroupHomeRecentGameRow {
  id: string;
  matchId: string | null;
  matchName: string | null;
  leagueId: string | null;
  leagueName: string | null;
  /** ISO 8601 timestamp of the game. */
  playedAt: string;
}

/**
 * Maximum row count for each list section on the S6 home. Kept tunable from
 * one place — same spirit as `DASHBOARD_RECENT_LIMIT`.
 */
export const GROUP_HOME_LEAGUES_LIMIT = 5;
export const GROUP_HOME_MATCHES_LIMIT = 5;
export const GROUP_HOME_RECENT_GAMES_LIMIT = 5;
