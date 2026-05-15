/**
 * Types used by the S4 Group 一覧 screen.
 *
 * Kept separate from `db/schema.ts` and `components/layout/types.ts` because:
 *  - The schema types carry storage-layer concerns (server-side `Date`,
 *    cascade rules) that screen components do not need.
 *  - The layout `GroupSummary` is intentionally minimal (id + name) for the
 *    switcher; the S4 list additionally surfaces aggregate metrics
 *    (`playerCount`, `lastPlayedAt`, `leagueCount`) per the spec in
 *    `04-screens.md` § S4.
 *
 * The route loader is responsible for projecting Drizzle rows into this
 * shape; the screen component never imports Drizzle directly.
 */

/**
 * Group projection used by the S4 list, the create modal (after submit),
 * and the edit modal (current values seed).
 *
 * `lastPlayedAt`: ISO 8601 string, or `null` if the Group has no Games yet.
 *   Mirrors the column type in `apps/web/src/db/schema.ts` (TEXT,
 *   service-side formatted).
 *
 * `hasHistory`: pre-computed from the service layer
 *   (`GroupService.hasHistory`). Bundled into the projection so the delete
 *   modal can decide its own copy without firing another round trip when it
 *   opens.
 */
export interface GroupListItem {
  id: string;
  name: string;
  playerCount: number;
  leagueCount: number;
  lastPlayedAt: string | null;
  hasHistory: boolean;
}
