/**
 * Shared types for the layout shells (Owner / Public).
 *
 * These shapes are deliberately *thin* — the layout itself does not care which
 * persistence layer the values came from. Route loaders are responsible for
 * mapping their entity types into these projections.
 */

/**
 * Minimal projection of the signed-in Owner that the header needs.
 * `null` means "not signed in" — every layout MUST tolerate that state without
 * breaking (Issue #11 acceptance criterion: 未認証状態でも UI が崩れない).
 */
export interface OwnerSession {
  ownerId: string;
  /** Display name, falling back to email local-part when nothing is set. */
  displayName: string;
}

/**
 * Minimal projection of a Group as it appears in the switcher list.
 */
export interface GroupSummary {
  id: string;
  name: string;
}
