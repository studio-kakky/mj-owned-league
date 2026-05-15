/**
 * Domain-level error types thrown by the service layer.
 *
 * These intentionally inherit from `Error` (not, say, a Result type) because:
 *  - The TanStack Start server functions / Workers handlers that will sit on
 *    top of these services already convert thrown errors into HTTP responses,
 *    so the call-site ergonomics are simpler than threading a Result through
 *    every layer.
 *  - Tests can assert on the concrete subclass via `instanceof`, which avoids
 *    string-matching on `error.message`.
 *
 * If a follow-up issue introduces a Result-based API, these classes can stay
 * — they only describe *which* domain rule was violated, not *how* it surfaces.
 */

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * Thrown when attempting to physically delete a Player that already has at
 * least one `GameResult` row. The caller is expected to fall back to setting
 * `isActive = false` (the "retirement" path described in
 * `02-domain-model.md` § Player).
 */
export class PlayerHasHistoryError extends DomainError {
  constructor(public readonly playerId: string) {
    super(`Player ${playerId} has game history and cannot be physically deleted`);
  }
}

/**
 * Thrown when creating / updating a Game with both `matchId` and `leagueId`
 * set, where `match.leagueId` does not match the supplied `leagueId`.
 * Covers the integrity rule in `02-domain-model.md` § Game.
 */
export class GameMatchLeagueMismatchError extends DomainError {
  constructor(
    public readonly gameLeagueId: string | null,
    public readonly matchLeagueId: string | null,
  ) {
    super(
      `Game.leagueId (${gameLeagueId ?? 'null'}) does not match Match.leagueId (${matchLeagueId ?? 'null'})`,
    );
  }
}

/**
 * Thrown when the referenced parent row (Match, Group, etc.) cannot be found
 * during a service operation. Repositories return `null` for missing rows;
 * services translate that into this error when the row is required for an
 * integrity check.
 */
export class EntityNotFoundError extends DomainError {
  constructor(
    public readonly entity: string,
    public readonly id: string,
  ) {
    super(`${entity} ${id} not found`);
  }
}

/**
 * Why an invitation token cannot be used. Returned via
 * `InvitationInvalidError` rather than swallowed as a generic Error so the
 * upstream Better Auth hook / sign-in route can produce a meaningful 4xx
 * response without re-deriving the reason via string matching.
 *
 * Mirrors the lifecycle in `apps/web/src/db/schema.ts` § Invitation:
 *  - `NOT_FOUND` — token does not exist (typo, deleted, never issued).
 *  - `EXPIRED`   — `expiresAt < now`. Status is irrelevant.
 *  - `CONSUMED`  — already used by some signup callback.
 *  - `REVOKED`   — Owner cancelled it before consumption.
 */
export const INVITATION_INVALID_REASONS = ['NOT_FOUND', 'EXPIRED', 'CONSUMED', 'REVOKED'] as const;
export type InvitationInvalidReason = (typeof INVITATION_INVALID_REASONS)[number];

export class InvitationInvalidError extends DomainError {
  constructor(public readonly reason: InvitationInvalidReason) {
    super(`Invitation cannot be used: ${reason}`);
  }
}
