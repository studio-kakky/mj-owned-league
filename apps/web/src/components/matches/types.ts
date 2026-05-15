/**
 * Types used by the S10 Match 作成 screen (`04-screens.md` § S10, Issue #20).
 *
 * Boundary rule mirrors `components/leagues/types.ts`: schema rows
 * (`Match`, `League`, `Ruleset`, `Player`) carry persistence concerns the
 * screen never needs, so we project narrower display shapes here. The route
 * loader owns the projection; the screen never imports Drizzle.
 *
 * Why two payload shapes (`MatchCreateContext` + `MatchCreateInput`):
 *   - The loader hands the screen everything it needs to render the form
 *     (the available Groups / Leagues / Rulesets / Players, plus the
 *     auto-allocated `sequenceNumber` when a `leagueId` was supplied).
 *   - The form submits a validated payload that omits all of that and only
 *     carries the user-entered values. The server resolves the rest from
 *     the ids alone.
 */

import type { LeagueFormat } from '../../db/schema';
import type { LeagueRulesetOption } from '../leagues/types';

/**
 * One Group surfaced to the form's "所属グループ" selector. Only Groups
 * owned by the caller are projected. `defaultRulesetId` is forwarded so the
 * form can pre-select the Group's default Ruleset before the user has
 * picked a League.
 */
export interface MatchCreateGroupOption {
  id: string;
  name: string;
  defaultRulesetId: string | null;
}

/**
 * One League surfaced to the form's "所属リーグ" selector. Comes pre-tagged
 * with `groupId` + `format` so the screen can filter by Group and lock the
 * `format` field when a League is chosen.
 *
 * `playerCount` is the count of *active* Players in the parent Group. Used
 * to surface the "3 人麻雀で参加者が足りない" guidance before the user
 * submits.
 */
export interface MatchCreateLeagueOption {
  id: string;
  groupId: string;
  name: string;
  format: LeagueFormat;
  defaultRulesetId: string | null;
}

/**
 * Ruleset option for the form's "デフォルト Ruleset" select. Tagged with
 * `groupId` so the screen can filter to the currently-selected Group.
 */
export interface MatchCreateRulesetOption extends LeagueRulesetOption {
  groupId: string;
}

/**
 * Loader payload powering the S10 form. The route loader composes this
 * server-side; the screen renders it without making any additional round
 * trips.
 *
 * `initialLeagueId` is set when the user landed on `/matches/new?leagueId=…`
 * from a League detail screen. The form locks the League selector to that
 * id (and locks `format` to the League's format) in that case.
 *
 * `initialGroupId` is set when the caller landed on `/matches/new?groupId=…`
 * (cross-League creation under a specific Group). When both query params
 * are absent we fall back to the Owner's first Group as the active context.
 */
export interface MatchCreateContext {
  groups: ReadonlyArray<MatchCreateGroupOption>;
  leagues: ReadonlyArray<MatchCreateLeagueOption>;
  rulesets: ReadonlyArray<MatchCreateRulesetOption>;
  /**
   * Active-Player counts per Group, used to gate 3-player Match creation.
   * The key is the Group id; the value is the number of `isActive=true`
   * Players in that Group. We pre-compute this server-side so the screen
   * does not need a separate "list players for group" loader.
   */
  activePlayerCountByGroup: Readonly<Record<string, number>>;
  /**
   * League the caller arrived with (via `?leagueId=…`). `null` when the
   * caller landed on `/matches/new` directly or with a Group-only context.
   */
  initialLeagueId: string | null;
  /**
   * Group preselected for the form's Group selector. Either the Group
   * containing `initialLeagueId`, or `?groupId=…`, or the Owner's first
   * Group, in that order. `null` when the Owner has no Groups yet — the
   * screen renders an empty-state pointing the user at S4 in that case.
   */
  initialGroupId: string | null;
  /**
   * The next `sequenceNumber` to use when creating a Match under
   * `initialLeagueId`. Server-computed as
   * `max(existing.sequenceNumber) + 1`, defaulting to 1 when the League is
   * empty. `null` when no `initialLeagueId` was supplied — the form does
   * not allocate one in the cross-Group case.
   */
  initialSequenceNumber: number | null;
}

/**
 * Form payload submitted by the S10 screen. The server validates the same
 * shape and resolves Group / Ruleset defaults at create time.
 *
 * - `leagueId === null` means "League 外 Match". `sequenceNumber` must
 *   then also be `null` because the doc only auto-numbers Matches under a
 *   League (`03-user-flow.md` § F5).
 * - `defaultRulesetId === null` lets the server fall back to the
 *   resolution chain "League default → Group default" at create time.
 * - `heldAt` is ISO `YYYY-MM-DD` per the schema's date convention; empty
 *   strings are normalised to `null`.
 */
export interface MatchCreateInput {
  groupId: string;
  leagueId: string | null;
  name: string;
  /** `YYYY-MM-DD` or `null`. */
  heldAt: string | null;
  memo: string | null;
  defaultRulesetId: string | null;
}

/**
 * Server-side result of a successful create. Mirrors the {@link MatchHeader}
 * the future S9 detail screen will need. Only `id` is consumed today — the
 * screen uses it to navigate the user to `/matches/$matchId` (or, for MVP,
 * back to the originating League).
 */
export interface CreatedMatchSummary {
  id: string;
  groupId: string;
  leagueId: string | null;
  name: string;
  sequenceNumber: number | null;
}
