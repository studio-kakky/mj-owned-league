/**
 * Types used by the S7 / S8 / S15 League screens (`04-screens.md` § S7 / S8 /
 * S15, Issue #18).
 *
 * Same boundary rule as `components/groups/types.ts`: the schema-layer
 * `League` row carries persistence concerns (D1 column types, FK shape) the
 * screen never needs, so we project into a narrower display shape. The route
 * loader owns the projection; the screen never imports Drizzle.
 *
 * Why two list shapes (`LeagueListItem`, `LeagueDetailData`):
 *   - The list view (S7 一覧) only needs name + format + aggregate counts to
 *     render its cards.
 *   - The detail view (S7 詳細) additionally needs the public URL, the
 *     applied Ruleset summary, a Match list, and a recent-games feed.
 *   Keeping the two narrow means the list loader does O(groups × leagues)
 *   work, not O(games) for every list render.
 *
 * The filter values mirror the issue acceptance criteria
 * ("すべて / 進行中 / 終了"). MVP treats every League as "進行中" because the
 * schema does not yet model an `endedAt` column — see the comment on
 * {@link LeagueStatus} below.
 */

import type { LeagueFormat, UmaPattern } from '../../db/schema';

/**
 * League lifecycle bucket as surfaced by the S7 / S15 list filter.
 *
 * The data model in `02-domain-model.md` § League does not yet define an
 * explicit `endedAt` / `archivedAt` column, so MVP cannot tell "終了" apart
 * from "進行中" structurally. The server therefore stamps every League with
 * `status: 'ACTIVE'`. The filter still ships because:
 *   - The design (`LeagueList.html`) calls for three filter pills.
 *   - Once a `closedAt` field lands, switching the projection is a one-line
 *     change in the server function; the screen stays put.
 *
 * Choosing the values up-front (rather than `'ALL' | 'OTHER'`) keeps the UI
 * code stable across the eventual schema change.
 */
export type LeagueStatus = 'ACTIVE' | 'ENDED';

export type LeagueListFilter = 'ALL' | LeagueStatus;

/**
 * Card-style projection used by the S7 / S15 League list.
 *
 * `matchCount` and `gameCount` are pre-aggregated server-side so the screen
 * can render counts without touching child collections.
 * `lastPlayedAt` is the most recent Game `playedAt` in the League, or `null`
 * when the League has no Games yet. Mirrors the same null-vs-empty-string
 * choice the dashboard uses.
 */
export interface LeagueListItem {
  id: string;
  groupId: string;
  groupName: string;
  name: string;
  format: LeagueFormat;
  status: LeagueStatus;
  matchCount: number;
  gameCount: number;
  /** Number of distinct Players who have a GameResult in this League. */
  playerCount: number;
  /** ISO 8601 timestamp of the most recent Game; `null` for empty Leagues. */
  lastPlayedAt: string | null;
  /** Random opaque slug from `02-domain-model.md` § League. */
  publicSlug: string;
}

/**
 * Ruleset option surfaced in the S8 create modal's "デフォルト Ruleset"
 * dropdown. The list comes from the active Group; the modal does not let the
 * user create a new Ruleset inline.
 */
export interface LeagueRulesetOption {
  id: string;
  name: string;
  startingScore: number;
  returnScore: number;
  umaPattern: UmaPattern;
  isGroupDefault: boolean;
}

/**
 * Group option surfaced in the S8 create modal's "Group" dropdown.
 *
 * The MVP does not yet have a global "active group" picker wired through the
 * route tree, so the create modal lets the Owner pick which Group the new
 * League belongs to. This also lets cross-group browsing of the list keep
 * working — the Owner can stay on `/leagues` and create Leagues into any of
 * their Groups.
 */
export interface LeagueGroupOption {
  id: string;
  name: string;
  /**
   * The Group's default Ruleset id, used to pre-select the dropdown when the
   * user picks a Group. `null` for Groups without one (the schema allows it).
   */
  defaultRulesetId: string | null;
}

/**
 * Payload submitted by the S8 create form. Validation happens server-side
 * (`createLeagueInput` in `server/leagues.ts`); the modal only enforces the
 * "name is non-empty" client-side guard.
 */
export interface LeagueCreateInput {
  groupId: string;
  name: string;
  format: LeagueFormat;
  /** `null` lets the server fall back to the Group's default Ruleset. */
  defaultRulesetId: string | null;
}

/**
 * Detail-view projection for the S7 League ダッシュボード
 * (`04-screens.md` § S7).
 *
 * The structure mirrors the acceptance criteria on Issue #18:
 *   - 順位表 → {@link LeagueDetailData.ranking}
 *   - Match 一覧 → {@link LeagueDetailData.matches}
 *   - 対局履歴 → {@link LeagueDetailData.recentGames}
 *   - 公開 URL → {@link LeagueDetailData.publicSlug} (the path is composed
 *     in the screen so a future slug-rename doesn't strand the URL).
 *
 * Ranking computation: leagues with at least one GameResult will eventually
 * fan out into the domain `scoring` module. The interim in-memory store
 * (`groups-store.ts`) does not yet hold GameResult rows; the server therefore
 * surfaces an empty `ranking` array but keeps the field shape stable so the
 * presentational tests can drive both populated and empty states.
 */
export interface LeagueDetailData {
  id: string;
  groupId: string;
  groupName: string;
  name: string;
  format: LeagueFormat;
  status: LeagueStatus;
  publicSlug: string;
  defaultRuleset: LeagueRulesetOption | null;
  matches: ReadonlyArray<LeagueMatchRow>;
  recentGames: ReadonlyArray<LeagueGameRow>;
  ranking: ReadonlyArray<LeagueRankingRow>;
}

export interface LeagueMatchRow {
  id: string;
  name: string;
  sequenceNumber: number | null;
  heldAt: string | null;
  gameCount: number;
}

export interface LeagueGameRow {
  id: string;
  matchId: string | null;
  matchName: string | null;
  playedAt: string;
}

/**
 * Per-player aggregate row in the League's 順位表. Kept narrow — the public
 * page (P1) will need a richer shape, but the Owner-side S7 only needs the
 * column set called out in `04-screens.md`.
 */
export interface LeagueRankingRow {
  playerId: string;
  playerName: string;
  gameCount: number;
  totalPoints: number;
  averagePoints: number;
  topCount: number;
  lastCount: number;
}

/**
 * Maximum row count for the "直近の対局" feed inside the detail view. Same
 * spirit as `DASHBOARD_RECENT_LIMIT` — kept tunable from one place.
 */
export const LEAGUE_DETAIL_RECENT_GAMES_LIMIT = 10;

/**
 * Aggregate payload the S7 / S15 loader hands to {@link LeagueListScreen}.
 *
 * Bundling the create-modal options into the list payload keeps the page on
 * a single round trip. Splitting them would force a second request the
 * first time the user clicks "新規作成" — measurably slower on a 3G
 * connection, and the dropdown contents are cheap to compute server-side
 * (one Map scan per Group).
 */
export interface LeagueListData {
  leagues: ReadonlyArray<LeagueListItem>;
  /**
   * Groups the Owner can pick from in the S8 create modal. Empty when the
   * Owner has no Groups yet — in which case the screen renders an empty
   * state that points the user at S4 instead of the create modal.
   */
  groups: ReadonlyArray<LeagueGroupOption>;
  /**
   * Every Ruleset across the Owner's Groups. The modal filters this
   * client-side once the user picks a Group, which is faster than fetching
   * per-group on dropdown change.
   */
  rulesets: ReadonlyArray<LeagueRulesetOptionWithGroup>;
}

/**
 * A {@link LeagueRulesetOption} plus the `groupId` it belongs to. The S8
 * create modal needs to filter Rulesets by the chosen Group, and shipping
 * the foreign key alongside the option is cheaper than re-fetching.
 */
export interface LeagueRulesetOptionWithGroup extends LeagueRulesetOption {
  groupId: string;
}
