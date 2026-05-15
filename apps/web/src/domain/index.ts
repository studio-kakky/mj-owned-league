/**
 * Domain layer entry point.
 *
 * Houses pure-function logic that the service layer composes via dependency
 * inversion. Nothing in here may import from `../services/*` (except for the
 * shared `DomainError` base) or `../repositories/*`. This keeps the domain
 * folder unit-testable without any infrastructure.
 */

export * from './scoring';
