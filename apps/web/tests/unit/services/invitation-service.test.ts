import { beforeEach, describe, expect, it } from 'vitest';
import { InvitationInvalidError } from '../../../src/services/errors';
import {
  INVITATION_DEFAULT_TTL_MS,
  InvitationService,
} from '../../../src/services/invitation-service';
import { FakeInvitationRepository } from './fakes';

/**
 * Covers the invitation lifecycle described in `docs/docs/03-user-flow.md`
 * § F1 / F10. Every test fixes `now`, `generateId`, and `generateToken` so
 * the assertions are exact — the service intentionally takes these as
 * constructor deps for this reason.
 */
describe('InvitationService', () => {
  const FIXED_NOW = new Date('2026-05-15T00:00:00.000Z');
  let repo: FakeInvitationRepository;
  let service: InvitationService;
  // Sequence counters give us stable, predictable values per test without
  // having to remember to reset module-level state.
  let idSeq = 0;
  let tokenSeq = 0;

  beforeEach(() => {
    repo = new FakeInvitationRepository();
    idSeq = 0;
    tokenSeq = 0;
    service = new InvitationService(repo, {
      now: () => new Date(FIXED_NOW),
      generateId: () => `inv-${++idSeq}`,
      generateToken: () => `tok-${++tokenSeq}`,
    });
  });

  describe('issue', () => {
    it('creates a PENDING invitation with a 7-day default expiry', async () => {
      const issued = await service.issue({ issuedByOwnerId: 'owner-1' });

      expect(issued.id).toBe('inv-1');
      expect(issued.token).toBe('tok-1');

      const stored = await repo.findById('inv-1');
      expect(stored).not.toBeNull();
      expect(stored?.status).toBe('PENDING');
      expect(stored?.issuedByOwnerId).toBe('owner-1');
      expect(stored?.consumedAt).toBeNull();
      expect(stored?.revokedAt).toBeNull();

      // 7 days after FIXED_NOW, expressed as ISO. We compute the expectation
      // arithmetically rather than hard-coding the literal so a future TTL
      // change only requires updating the constant.
      const expected = new Date(FIXED_NOW.getTime() + INVITATION_DEFAULT_TTL_MS).toISOString();
      expect(stored?.expiresAt).toBe(expected);
    });

    it('honours a custom ttlMs override', async () => {
      const oneHourMs = 60 * 60 * 1000;
      const issued = await service.issue({ issuedByOwnerId: 'owner-1', ttlMs: oneHourMs });
      const expected = new Date(FIXED_NOW.getTime() + oneHourMs).toISOString();
      expect(issued.expiresAt).toBe(expected);
    });

    it('records the Owner memo when provided', async () => {
      await service.issue({ issuedByOwnerId: 'owner-1', memo: 'for Bob' });
      const stored = await repo.findById('inv-1');
      expect(stored?.memo).toBe('for Bob');
    });
  });

  describe('verify', () => {
    it('returns the invitation when the token is PENDING and not expired', async () => {
      const issued = await service.issue({ issuedByOwnerId: 'owner-1' });
      const verified = await service.verify(issued.token);
      expect(verified.id).toBe(issued.id);
    });

    it('throws NOT_FOUND for unknown tokens', async () => {
      await expect(service.verify('nope')).rejects.toMatchObject({
        // The error class is exported so callers can `instanceof`-check.
        constructor: InvitationInvalidError,
        reason: 'NOT_FOUND',
      });
    });

    it('throws EXPIRED when the token has passed its expiry', async () => {
      // Construct a service whose "now" is *before* expiry to issue, then
      // create a second service whose "now" is *after* expiry to verify.
      // This isolates the time-travel to the verifier so the issuer path
      // remains untouched.
      const issuer = new InvitationService(repo, {
        now: () => new Date('2026-05-01T00:00:00.000Z'),
        generateId: () => 'inv-x',
        generateToken: () => 'tok-x',
      });
      await issuer.issue({ issuedByOwnerId: 'owner-1', ttlMs: 60_000 });

      const verifier = new InvitationService(repo, {
        now: () => new Date('2026-05-02T00:00:00.000Z'),
      });
      await expect(verifier.verify('tok-x')).rejects.toMatchObject({
        constructor: InvitationInvalidError,
        reason: 'EXPIRED',
      });
    });

    it('throws CONSUMED once the token has been used', async () => {
      const issued = await service.issue({ issuedByOwnerId: 'owner-1' });
      await service.consume(issued.token, 'user-1');

      await expect(service.verify(issued.token)).rejects.toMatchObject({
        constructor: InvitationInvalidError,
        reason: 'CONSUMED',
      });
    });

    it('throws REVOKED once the issuer cancels the invitation', async () => {
      const issued = await service.issue({ issuedByOwnerId: 'owner-1' });
      await service.revoke(issued.id);

      await expect(service.verify(issued.token)).rejects.toMatchObject({
        constructor: InvitationInvalidError,
        reason: 'REVOKED',
      });
    });
  });

  describe('consume', () => {
    it('marks the invitation CONSUMED and records who used it', async () => {
      const issued = await service.issue({ issuedByOwnerId: 'owner-1' });

      const consumed = await service.consume(issued.token, 'user-1');

      expect(consumed.status).toBe('CONSUMED');
      expect(consumed.consumedByUserId).toBe('user-1');
      expect(consumed.consumedAt).toBe(FIXED_NOW.toISOString());
    });

    it('refuses to consume an already-consumed token', async () => {
      const issued = await service.issue({ issuedByOwnerId: 'owner-1' });
      await service.consume(issued.token, 'user-1');

      await expect(service.consume(issued.token, 'user-2')).rejects.toMatchObject({
        constructor: InvitationInvalidError,
        reason: 'CONSUMED',
      });
    });

    it('refuses to consume a revoked token', async () => {
      const issued = await service.issue({ issuedByOwnerId: 'owner-1' });
      await service.revoke(issued.id);

      await expect(service.consume(issued.token, 'user-1')).rejects.toMatchObject({
        constructor: InvitationInvalidError,
        reason: 'REVOKED',
      });
    });

    it('refuses to consume an expired token', async () => {
      const issuer = new InvitationService(repo, {
        now: () => new Date('2026-05-01T00:00:00.000Z'),
        generateId: () => 'inv-y',
        generateToken: () => 'tok-y',
      });
      await issuer.issue({ issuedByOwnerId: 'owner-1', ttlMs: 60_000 });

      const consumer = new InvitationService(repo, {
        now: () => new Date('2026-05-02T00:00:00.000Z'),
      });
      await expect(consumer.consume('tok-y', 'user-1')).rejects.toMatchObject({
        constructor: InvitationInvalidError,
        reason: 'EXPIRED',
      });
    });
  });

  describe('revoke', () => {
    it('marks a PENDING invitation REVOKED with a timestamp', async () => {
      const issued = await service.issue({ issuedByOwnerId: 'owner-1' });

      const revoked = await service.revoke(issued.id);

      expect(revoked.status).toBe('REVOKED');
      expect(revoked.revokedAt).toBe(FIXED_NOW.toISOString());
    });

    it('throws NOT_FOUND when the invitation does not exist', async () => {
      await expect(service.revoke('missing')).rejects.toMatchObject({
        constructor: InvitationInvalidError,
        reason: 'NOT_FOUND',
      });
    });

    it('refuses to revoke an already-consumed invitation', async () => {
      const issued = await service.issue({ issuedByOwnerId: 'owner-1' });
      await service.consume(issued.token, 'user-1');

      await expect(service.revoke(issued.id)).rejects.toMatchObject({
        constructor: InvitationInvalidError,
        reason: 'CONSUMED',
      });
    });
  });

  describe('listByIssuer', () => {
    it('returns only invitations issued by the given Owner', async () => {
      await service.issue({ issuedByOwnerId: 'owner-1' });
      await service.issue({ issuedByOwnerId: 'owner-1' });
      await service.issue({ issuedByOwnerId: 'owner-2' });

      const list = await service.listByIssuer('owner-1');
      expect(list).toHaveLength(2);
      expect(list.every((i) => i.issuedByOwnerId === 'owner-1')).toBe(true);
    });
  });
});
