/**
 * Types used by the S9 Match 詳細 + S11-S13 対局 CRUD modals
 * (`04-screens.md` § S9 / S11 / S12 / S13, Issue #19).
 *
 * Boundary rule mirrors `components/leagues/types.ts`: schema rows
 * (`Match`, `Game`, `GameResult`, `Player`, `Ruleset`) carry persistence
 * concerns the screen never needs, so we project narrower display shapes
 * here. The route loader owns the projection; the screen never imports
 * Drizzle.
 *
 * Why a single payload (`MatchDetailData`) for the whole screen:
 *   The S9 detail view renders header + ranking + game list + add-game modal
 *   options. Splitting these into separate loaders would force a round trip
 *   on every modal open; bundling them keeps the page on a single fetch,
 *   matches the S7 League detail loader, and is cheap server-side because
 *   everything is keyed off one Match id.
 */

import type { LeagueFormat, TobiRole, UmaPattern } from '../../db/schema';

/**
 * One row in the Match's internal 順位表 (順位 / 累計ポイント / 平均 / トップ /
 * ラス). Pre-aggregated server-side from {@link MatchGameRow.results}; the
 * screen sorts by `totalPoints` desc and renders verbatim.
 *
 * `gameCount` counts every Game in which this player appears. `playerName` is
 * snapshotted at projection time — even if the Player is later renamed, the
 * historical record can stay readable.
 */
export interface MatchRankingRow {
  playerId: string;
  playerName: string;
  gameCount: number;
  totalPoints: number;
  averagePoints: number;
  /** Count of `rank === 1` finishes. */
  topCount: number;
  /** Count of `rank === N` (last place) finishes; N derives from format. */
  lastCount: number;
}

/**
 * Player option surfaced in the S11 対局結果入力 modal's player picker.
 *
 * Only active Players from the Match's Group are included — historical
 * (inactive) Players still appear on game rows, but cannot be added to new
 * games. The picker enforces uniqueness client-side.
 */
export interface MatchPlayerOption {
  id: string;
  name: string;
  isActive: boolean;
}

/**
 * Ruleset option for the S11 modal's "適用 Ruleset" selector. The Match's
 * default is surfaced first; the user can override per Game.
 */
export interface MatchRulesetOption {
  id: string;
  name: string;
  startingScore: number;
  returnScore: number;
  umaPattern: UmaPattern;
  tobiEnabled: boolean;
  tobiPoint: number | null;
  isMatchDefault: boolean;
  isGroupDefault: boolean;
}

/**
 * One player's outcome in a single Game, projected for the S9 / S13 row.
 * `tobiRole` is `null` for non-tobi games (most of them).
 */
export interface MatchGameResultRow {
  playerId: string;
  playerName: string;
  rawScore: number;
  points: number;
  rank: number;
  tobiRole: TobiRole | null;
}

/**
 * One Game inside the Match — surfaced both in the chronological game list
 * and as the seed for the S12 edit modal. Results are sorted by `rank` asc
 * so the screen does not have to re-sort.
 */
export interface MatchGameRow {
  id: string;
  playedAt: string;
  rulesetId: string;
  rulesetName: string;
  results: ReadonlyArray<MatchGameResultRow>;
}

/**
 * Top-level S9 payload. The loader projects this once per visit; modals work
 * off this snapshot plus per-action server-function round trips.
 */
export interface MatchDetailData {
  id: string;
  groupId: string;
  groupName: string;
  /** `null` for League 外 Match — the screen still renders, the public link
   * just lives under `/m/:publicSlug` (not used in MVP). */
  leagueId: string | null;
  leagueName: string | null;
  leaguePublicSlug: string | null;
  /** Auto-allocated for League 配下 Matches; `null` for standalone. */
  sequenceNumber: number | null;
  name: string;
  heldAt: string | null;
  memo: string | null;
  /**
   * The format used for any new Games in this Match. Inherited from the
   * League when the Match has one; otherwise defaulted to `4P_HANCHAN`
   * (the App-wide default).
   */
  format: LeagueFormat;
  /**
   * Default Ruleset for new Games. Resolution order = Match default →
   * League default → Group default. `null` only when none of them exist.
   */
  defaultRuleset: MatchRulesetOption | null;
  /** Every Ruleset under the Match's Group — the modal filters to this. */
  availableRulesets: ReadonlyArray<MatchRulesetOption>;
  /** Active Players in the Match's Group. The picker uses this. */
  availablePlayers: ReadonlyArray<MatchPlayerOption>;
  ranking: ReadonlyArray<MatchRankingRow>;
  games: ReadonlyArray<MatchGameRow>;
}

/**
 * Card-style projection used by the S9 list view (League-scoped).
 *
 * `gameCount` is pre-aggregated server-side. `heldAt` is `null` for
 * undated Matches; the screen surfaces "未設定" in that case. `lastPlayedAt`
 * is the most recent Game `playedAt` inside the Match.
 */
export interface MatchListItem {
  id: string;
  groupId: string;
  leagueId: string | null;
  leagueName: string | null;
  name: string;
  sequenceNumber: number | null;
  heldAt: string | null;
  gameCount: number;
  lastPlayedAt: string | null;
}

/**
 * Aggregate payload the S9 list loader hands to {@link MatchListScreen}.
 *
 * The list is always scoped to one Group (`/groups/:groupId/matches`, Issue
 * #61). When `leagueId` is set the loader further filters to that League (the
 * リーグセレクタ chips and the S7 League detail deep-link both use it). The
 * `?leagueId=` filter is validated server-side to belong to the same Group —
 * a foreign / stale id falls back to the Group-wide list.
 *
 * `leagueName` is null when the list shows every Match in the Group (= no
 * single League).
 *
 * `leagueOptions` lists every League in the scoped Group, so the in-page
 * リーグセレクタ can switch the filter without an extra round trip. Order is
 * `name` ascending. Because every option is in the same Group there is no
 * cross-Group name collision to disambiguate.
 */
export interface MatchListData {
  /** The Group the list is scoped to (from the URL path). */
  groupId: string;
  groupName: string;
  matches: ReadonlyArray<MatchListItem>;
  /** Set when the list is filtered to a single League — drives the header. */
  scope: MatchListScope;
  /** Every League in the scoped Group — drives the in-page selector. */
  leagueOptions: ReadonlyArray<MatchListLeagueOption>;
}

export interface MatchListScope {
  /** `null` for the Group-wide list; set when filtered by League. */
  leagueId: string | null;
  leagueName: string | null;
  /** Convenience search for "Match を追加" — pre-filled with `?leagueId=` when scoped. */
  createSearch: { leagueId?: string };
}

/**
 * One entry in the in-page リーグセレクタ. Every option belongs to the scoped
 * Group, so no Group disambiguation label is needed (Issue #61).
 */
export interface MatchListLeagueOption {
  id: string;
  name: string;
}

/**
 * Payload submitted by the S11 対局結果入力 modal (and S12 reuses the same
 * shape with `gameId` populated for updates). The server resolves the
 * Ruleset details, recomputes points / ranks via the domain scoring module,
 * and persists the Game + GameResult rows together.
 *
 * - `playedAt` is ISO 8601 string — the server defaults to "now" when null
 *   (the modal pre-fills with the Match's `heldAt` or today).
 * - `players` has exactly `format`-many entries; the server re-asserts.
 * - `rawScores` and `tobiRoles` are parallel arrays keyed by `players[i].id`
 *   index; the modal builds them together to keep them in lockstep.
 */
export interface GameSubmitInput {
  matchId: string;
  /** Set when editing an existing Game (S12). `null` for create (S11). */
  gameId: string | null;
  rulesetId: string;
  playedAt: string | null;
  players: ReadonlyArray<GameSubmitPlayer>;
}

export interface GameSubmitPlayer {
  playerId: string;
  rawScore: number;
  tobiRole: TobiRole | null;
}
