/**
 * Types used by the S16 Settings screen (`04-screens.md` § S16, Issue #17).
 *
 * Two independent collections live on this screen — Ruleset テンプレート and
 * Player — so each gets its own list-item projection. They share the
 * `groupId` scope: the Group comes from the URL path
 * (`/groups/:groupId/settings`, Issue #62) and the server function returns
 * Rulesets / Players bound to that Group only.
 *
 * Shapes are deliberately presentational. The screen never imports Drizzle
 * row types; the server function projects rows into these shapes.
 */

import type { UmaPattern } from '../../db/schema';

/**
 * Card-style projection of a single Ruleset in the management list.
 *
 * `isDefault` is computed at the server function — it mirrors
 * `groups.defaultRulesetId === ruleset.id`. The screen uses it to render a
 * "デフォルト" badge plus to disable the "デフォルトにする" action on the
 * currently-default row.
 */
export interface SettingsRulesetItem {
  id: string;
  name: string;
  startingScore: number;
  returnScore: number;
  umaPattern: UmaPattern;
  tobiEnabled: boolean;
  /** Required when `tobiEnabled === true`; null otherwise (see RulesetService). */
  tobiPoint: number | null;
  isDefault: boolean;
}

/**
 * Card-style projection of a single Player in the management list.
 *
 * `hasHistory` mirrors `PlayerRepository.hasGameHistory` — when `true`,
 * physical deletion is blocked and the UI flips the destructive action over
 * to "非アクティブ化" (the `02-domain-model.md` § Player retirement path).
 *
 * `isActive` is the soft-retirement flag. Inactive players cannot be added
 * to new Games but stay searchable in history.
 */
export interface SettingsPlayerItem {
  id: string;
  name: string;
  isActive: boolean;
  hasHistory: boolean;
}

/**
 * Top-level payload the Settings loader hands to {@link SettingsScreen}.
 *
 * `group` is always present (Issue #62): the route loads Settings for the
 * Group named in the URL path and the server returns `null` (→ route
 * redirect to `/groups`) for a missing / foreign Group, so the screen never
 * has to render a "no active group" empty state. The summary still flows
 * through so the header can show the Group name.
 */
export interface SettingsData {
  group: SettingsGroupSummary;
  rulesets: ReadonlyArray<SettingsRulesetItem>;
  players: ReadonlyArray<SettingsPlayerItem>;
}

export interface SettingsGroupSummary {
  id: string;
  name: string;
  /** Current default Ruleset id, or null if none. */
  defaultRulesetId: string | null;
}

/**
 * Input shape for creating / editing a Ruleset from the form modal.
 *
 * Mirrors the relevant subset of `NewRuleset` minus `id` / `groupId` — those
 * are filled in by the server function from the active group + UUID factory.
 */
export interface RulesetFormInput {
  name: string;
  startingScore: number;
  returnScore: number;
  umaPattern: UmaPattern;
  tobiEnabled: boolean;
  /** Required when `tobiEnabled === true`. The form clears it on toggle-off. */
  tobiPoint: number | null;
}
