/**
 * Types used by the S14 招待管理 screen (`04-screens.md` § S14, Issue #21).
 *
 * The screen is read-only-by-projection: the route loader hands a list of
 * `InvitationListItem` rows already classified into one of four UI statuses
 * ({@link InvitationUiStatus}) so the screen never has to recompute "is this
 * still usable?" — that calculation lives next to the `InvitationService`
 * lifecycle rules (PENDING / CONSUMED / REVOKED + expiry → UI status).
 *
 * Why a separate UI status rather than reusing {@link InvitationStatus}:
 *   - The domain status `PENDING` can be either "actionable" (revocable,
 *     URL still copyable) or "expired" (token past its TTL but never
 *     consumed / revoked). The screen needs to draw those two cases
 *     differently — same row class, different label.
 *   - `EXPIRED` is therefore a *display* concept; the DB column stays
 *     `PENDING` until/unless a future reaping pass rewrites it. Keeping
 *     this distinction in the projection layer means the screen does not
 *     need to know about wall-clock time.
 */

/**
 * Distinct labels used in the S14 status pill. Order matches the order the
 * UI renders the filter (if/when a filter is added).
 *   - `PENDING`  — token is still usable; "リンクをコピー" + "取消" both available.
 *   - `EXPIRED`  — domain status is PENDING but `expiresAt < now`; read-only.
 *   - `CONSUMED` — invitee completed signup; read-only.
 *   - `REVOKED`  — Owner cancelled before consumption; read-only.
 */
export const INVITATION_UI_STATUSES = ['PENDING', 'EXPIRED', 'CONSUMED', 'REVOKED'] as const;
export type InvitationUiStatus = (typeof INVITATION_UI_STATUSES)[number];

/**
 * Projection of a single invitation row for the S14 一覧.
 *
 * `token` is included so the screen can rebuild the share URL without a
 * second round-trip. The screen never displays the raw token; it composes
 * `${origin}/invitations/accept/${token}` and shows that.
 */
export interface InvitationListItem {
  id: string;
  /** Owner-supplied memo ("誰宛か"). `null` when omitted. */
  memo: string | null;
  /** Raw token; used to build the share URL on the client. */
  token: string;
  /** UI-facing status (see {@link INVITATION_UI_STATUSES}). */
  status: InvitationUiStatus;
  /** ISO timestamp. Shown formatted in the row. */
  createdAt: string;
  /** ISO timestamp. Shown formatted in the row. */
  expiresAt: string;
}
