/**
 * InvitationService — issue / verify / consume / revoke invite tokens
 * (`docs/docs/03-user-flow.md` § F1 / F10).
 *
 * Why this exists as its own service:
 *   - The invitation lifecycle is the *only* gate that controls who can sign
 *     up as a new Owner. Public sign-up is intentionally disabled in the
 *     Better Auth config (`apps/web/src/auth/*`).
 *   - The lifecycle (PENDING → CONSUMED / REVOKED, plus expiry) has enough
 *     state to be worth modelling outside the route layer, and it needs to be
 *     unit-testable without spinning up Better Auth or D1.
 *
 * Boundaries:
 *   - This service does NOT create Owner / user rows on consumption. It only
 *     validates and marks the token consumed. Linking the new Better Auth
 *     `user` to a domain `owners` row is the responsibility of the auth
 *     bootstrap layer (Better Auth `databaseHooks.user.create.after` —
 *     scaffolded in a follow-up issue once the real OAuth client lands).
 *   - Token generation uses `crypto.randomUUID()` for portability across
 *     Node.js (tests) and the Workers runtime. UUID v4 carries 122 bits of
 *     entropy which is plenty for an invitation URL gate — at MVP scale the
 *     Owner pool is single-digit, brute-force is not a credible threat, and
 *     the token still gates Google OAuth on the far side.
 */

import {
  INVITATION_STATUSES,
  type Invitation,
  type InvitationStatus,
  type NewInvitation,
} from '../db/schema';
import type { InvitationRepository } from '../repositories/interfaces';
import { InvitationInvalidError } from './errors';

/**
 * 7-day default expiry, from `docs/docs/03-user-flow.md` § 仮置き事項. Exported
 * so tests don't have to re-derive the literal and so a future
 * configuration-driven override has a single override point.
 */
export const INVITATION_DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Narrow type for the value the service hands back from `issue`. We avoid
 * leaking the full `Invitation` row for clarity at call-sites: the route /
 * server function only needs the URL-bearing token and the id.
 */
export interface IssuedInvitation {
  id: string;
  token: string;
  expiresAt: string;
}

/** Optional injection point for tests and for the Workers runtime. */
export interface InvitationServiceDeps {
  /**
   * Wall-clock source. Defaults to `Date.now()`. Override in tests to make
   * expiry assertions deterministic.
   */
  now?: () => Date;
  /**
   * UUID factory. Defaults to `crypto.randomUUID()`. Override in tests for
   * stable IDs without monkey-patching `globalThis.crypto`.
   */
  generateId?: () => string;
  /**
   * Token factory. Defaults to `crypto.randomUUID()`. Separate from
   * `generateId` so callers can swap to a higher-entropy or URL-shaped
   * generator without affecting row IDs.
   */
  generateToken?: () => string;
}

export interface IssueInvitationInput {
  issuedByOwnerId: string;
  /** Optional Owner-facing memo (`docs/docs/03-user-flow.md` § F10 step 2). */
  memo?: string | null;
  /**
   * Override the default 7-day expiry. Tests use this; production callers
   * should let the default ride.
   */
  ttlMs?: number;
}

export class InvitationService {
  private readonly now: () => Date;
  private readonly generateId: () => string;
  private readonly generateToken: () => string;

  constructor(
    private readonly repo: InvitationRepository,
    deps: InvitationServiceDeps = {},
  ) {
    // Resolve dependencies in the constructor rather than at call sites so
    // tests get a single place to override and the hot path stays branch-free.
    this.now = deps.now ?? (() => new Date());
    this.generateId = deps.generateId ?? (() => crypto.randomUUID());
    this.generateToken = deps.generateToken ?? (() => crypto.randomUUID());
  }

  /**
   * Create a new PENDING invitation. The caller passes the issuing Owner;
   * the service synthesises the id, token, status, and `expiresAt`.
   */
  async issue(input: IssueInvitationInput): Promise<IssuedInvitation> {
    const now = this.now();
    const ttl = input.ttlMs ?? INVITATION_DEFAULT_TTL_MS;
    const expiresAt = new Date(now.getTime() + ttl);

    const id = this.generateId();
    const token = this.generateToken();

    const row: NewInvitation = {
      id,
      issuedByOwnerId: input.issuedByOwnerId,
      memo: input.memo ?? null,
      token,
      status: 'PENDING',
      expiresAt: expiresAt.toISOString(),
    };

    const created = await this.repo.create(row);
    return { id: created.id, token: created.token, expiresAt: created.expiresAt };
  }

  /**
   * Look up an invitation by raw token and return it if (and only if) it is
   * currently usable — PENDING, not revoked, not yet consumed, not expired.
   * Throws `InvitationInvalidError` otherwise so the upstream Better Auth
   * hook can convert the reason into a 4xx response without round-tripping
   * through a Result type.
   */
  async verify(token: string): Promise<Invitation> {
    const invitation = await this.repo.findByToken(token);
    if (!invitation) {
      throw new InvitationInvalidError('NOT_FOUND');
    }
    this.assertUsable(invitation);
    return invitation;
  }

  /**
   * Atomic-from-the-caller's-perspective consumption: re-verifies the token,
   * then marks it CONSUMED in a single repository update. The caller passes
   * the freshly-created user's id so the audit trail records who used it.
   *
   * Race note: at MVP scale we don't worry about two concurrent consumes of
   * the same token. The unique index on `token` plus the verify-then-update
   * pattern make a duplicate consume merely idempotent-ish (the second call
   * also sees `CONSUMED` and throws). A future hardening pass could move this
   * to a single conditional UPDATE.
   */
  async consume(token: string, consumedByUserId: string): Promise<Invitation> {
    const invitation = await this.verify(token);
    const consumedAt = this.now().toISOString();

    const updated = await this.repo.update(invitation.id, {
      status: 'CONSUMED' satisfies InvitationStatus,
      consumedByUserId,
      consumedAt,
    });
    if (!updated) {
      // The row was deleted between verify and update. Practically impossible
      // in MVP (we never delete invitations) but we surface it explicitly so
      // a future race is debuggable.
      throw new InvitationInvalidError('NOT_FOUND');
    }
    return updated;
  }

  /**
   * Owner-initiated cancellation. Only PENDING invitations can be revoked;
   * trying to revoke a CONSUMED / REVOKED / EXPIRED one is an error so the
   * UI does not silently mask a bug.
   */
  async revoke(id: string): Promise<Invitation> {
    const invitation = await this.repo.findById(id);
    if (!invitation) {
      throw new InvitationInvalidError('NOT_FOUND');
    }
    this.assertUsable(invitation);

    const revokedAt = this.now().toISOString();
    const updated = await this.repo.update(id, {
      status: 'REVOKED' satisfies InvitationStatus,
      revokedAt,
    });
    if (!updated) {
      throw new InvitationInvalidError('NOT_FOUND');
    }
    return updated;
  }

  /**
   * Owner-facing listing. Status filtering is the caller's problem — we
   * return everything ordered by creation time descending would be a nice
   * polish but the repository doesn't currently expose ordering.
   */
  listByIssuer(ownerId: string): Promise<Invitation[]> {
    return this.repo.listByIssuer(ownerId);
  }

  /**
   * Centralised "is this invitation currently usable?" check. Used by both
   * `verify` and `revoke` so the rules don't drift between call sites.
   */
  private assertUsable(invitation: Invitation): void {
    if (this.isExpired(invitation)) {
      throw new InvitationInvalidError('EXPIRED');
    }
    // Exhaustiveness: `INVITATION_STATUSES` includes PENDING / CONSUMED / REVOKED.
    // PENDING is the only good state; the other two are explicit errors.
    switch (invitation.status) {
      case 'PENDING':
        return;
      case 'CONSUMED':
        throw new InvitationInvalidError('CONSUMED');
      case 'REVOKED':
        throw new InvitationInvalidError('REVOKED');
      default: {
        // `INVITATION_STATUSES` is a closed set; this branch only fires if the
        // schema gains a new status without updating this switch. We coerce
        // to `never` so TypeScript flags the omission at compile time.
        const _exhaustive: never = invitation.status;
        // Reference `INVITATION_STATUSES` to keep the import non-trivial: the
        // value also acts as the runtime source-of-truth for tests iterating
        // over every status.
        void INVITATION_STATUSES;
        throw new InvitationInvalidError(_exhaustive);
      }
    }
  }

  private isExpired(invitation: Invitation): boolean {
    // `expiresAt` is stored as ISO text. `Date.parse` returns NaN for invalid
    // input; we treat NaN as "expired" to fail safe rather than letting a
    // malformed row act as a permanent invitation.
    const expiresAtMs = Date.parse(invitation.expiresAt);
    if (Number.isNaN(expiresAtMs)) return true;
    return expiresAtMs <= this.now().getTime();
  }
}
