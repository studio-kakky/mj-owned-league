/**
 * Tests for `/invitations/accept/$token` server-function handlers (Issue #13).
 *
 * Exercising the handlers directly (not the `createServerFn` wrappers) is the
 * same pattern as `server/invitations.test.ts` etc. Each test resets the
 * module-level store via `resetGroupServerStoreForTests`.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  getGroupServerStore,
  resetGroupServerStoreForTests,
} from '../../../src/server/groups-store';
import {
  consumeInvitationHandler,
  verifyInvitationHandler,
} from '../../../src/server/invitation-accept';

const owner = 'owner-test-1';

// `2026-05-15` predates the dev-seeded invitation expiry (2099-01-01) so the
// seeded row projects as `valid` rather than `EXPIRED`.
const fixedNow = new Date('2026-05-15T00:00:00.000Z');

beforeEach(() => {
  resetGroupServerStoreForTests();
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Seeds a single PENDING invitation directly into the store. Returns the
 * generated token so the caller can hand it to the verify/consume handlers.
 *
 * We deliberately bypass `issueInvitationHandler` here — the verify handler
 * intentionally does not seed the dev fixtures (see its docstring), so
 * tests that exercise verify in isolation need to set up the row by hand.
 */
function seedInvitation(input: {
  id: string;
  ownerId: string;
  token: string;
  status?: 'PENDING' | 'CONSUMED' | 'REVOKED';
  memo?: string | null;
  expiresAt?: string;
}): void {
  const store = getGroupServerStore();
  store.invitations.set(input.id, {
    id: input.id,
    issuedByOwnerId: input.ownerId,
    memo: input.memo ?? null,
    token: input.token,
    status: input.status ?? 'PENDING',
    expiresAt: input.expiresAt ?? '2099-01-01T00:00:00.000Z',
    consumedByUserId: null,
    consumedAt: null,
    revokedAt: null,
    createdAt: '2026-05-10T00:00:00.000Z',
  });
}

// ---------------------------------------------------------------------------
// verifyInvitationHandler
// ---------------------------------------------------------------------------

describe('verifyInvitationHandler', () => {
  it('returns valid + projected fields for a PENDING token', async () => {
    seedInvitation({
      id: 'inv-1',
      ownerId: owner,
      token: 'tok-valid',
      memo: '田中さん',
    });

    const result = await verifyInvitationHandler(
      { token: 'tok-valid' },
      {
        now: () => fixedNow,
        resolveIssuerEmail: async () => 'issuer@example.com',
      },
    );

    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') return;
    expect(result.memo).toBe('田中さん');
    expect(result.issuerEmail).toBe('issuer@example.com');
    expect(result.expiresAt).toBe('2099-01-01T00:00:00.000Z');
  });

  it('returns invalid NOT_FOUND for an unknown token', async () => {
    const result = await verifyInvitationHandler(
      { token: 'does-not-exist' },
      { now: () => fixedNow },
    );
    expect(result).toEqual({ kind: 'invalid', reason: 'NOT_FOUND' });
  });

  it('returns invalid EXPIRED when the row is PENDING but past expiresAt', async () => {
    seedInvitation({
      id: 'inv-expired',
      ownerId: owner,
      token: 'tok-expired',
      expiresAt: '2026-05-10T00:00:00.000Z',
    });

    const result = await verifyInvitationHandler({ token: 'tok-expired' }, { now: () => fixedNow });
    expect(result).toEqual({ kind: 'invalid', reason: 'EXPIRED' });
  });

  it('returns invalid CONSUMED when the row has already been used', async () => {
    seedInvitation({
      id: 'inv-consumed',
      ownerId: owner,
      token: 'tok-consumed',
      status: 'CONSUMED',
    });

    const result = await verifyInvitationHandler(
      { token: 'tok-consumed' },
      { now: () => fixedNow },
    );
    expect(result).toEqual({ kind: 'invalid', reason: 'CONSUMED' });
  });

  it('returns invalid REVOKED when the row was cancelled before consumption', async () => {
    seedInvitation({
      id: 'inv-revoked',
      ownerId: owner,
      token: 'tok-revoked',
      status: 'REVOKED',
    });

    const result = await verifyInvitationHandler({ token: 'tok-revoked' }, { now: () => fixedNow });
    expect(result).toEqual({ kind: 'invalid', reason: 'REVOKED' });
  });

  it('falls back to an empty issuer email when the resolver returns null', async () => {
    seedInvitation({ id: 'inv-noissuer', ownerId: owner, token: 'tok-noissuer' });

    const result = await verifyInvitationHandler(
      { token: 'tok-noissuer' },
      { now: () => fixedNow, resolveIssuerEmail: async () => null },
    );
    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') return;
    expect(result.issuerEmail).toBe('');
  });
});

// ---------------------------------------------------------------------------
// consumeInvitationHandler
// ---------------------------------------------------------------------------

describe('consumeInvitationHandler', () => {
  it('marks a PENDING invitation as CONSUMED and records the user id', async () => {
    seedInvitation({ id: 'inv-c1', ownerId: owner, token: 'tok-c1' });

    const result = await consumeInvitationHandler(
      { token: 'tok-c1', userId: 'user-new-1' },
      { now: () => fixedNow },
    );

    expect(result).toEqual({ consumed: true });

    const store = getGroupServerStore();
    const stored = store.invitations.get('inv-c1');
    expect(stored?.status).toBe('CONSUMED');
    expect(stored?.consumedByUserId).toBe('user-new-1');
    expect(stored?.consumedAt).toBe(fixedNow.toISOString());
  });

  it('rejects consumption of an unknown token with NOT_FOUND', async () => {
    await expect(
      consumeInvitationHandler(
        { token: 'no-such-token', userId: 'user-x' },
        { now: () => fixedNow },
      ),
    ).rejects.toMatchObject({ reason: 'NOT_FOUND' });
  });

  it('rejects consumption of an expired token with EXPIRED', async () => {
    seedInvitation({
      id: 'inv-old',
      ownerId: owner,
      token: 'tok-old',
      expiresAt: '2026-05-10T00:00:00.000Z',
    });

    await expect(
      consumeInvitationHandler({ token: 'tok-old', userId: 'user-x' }, { now: () => fixedNow }),
    ).rejects.toMatchObject({ reason: 'EXPIRED' });
  });

  it('rejects re-consumption of an already-consumed token with CONSUMED', async () => {
    seedInvitation({
      id: 'inv-used',
      ownerId: owner,
      token: 'tok-used',
      status: 'CONSUMED',
    });

    await expect(
      consumeInvitationHandler({ token: 'tok-used', userId: 'user-x' }, { now: () => fixedNow }),
    ).rejects.toMatchObject({ reason: 'CONSUMED' });
  });

  it('rejects consumption of a revoked token with REVOKED', async () => {
    seedInvitation({
      id: 'inv-rev',
      ownerId: owner,
      token: 'tok-rev',
      status: 'REVOKED',
    });

    await expect(
      consumeInvitationHandler({ token: 'tok-rev', userId: 'user-x' }, { now: () => fixedNow }),
    ).rejects.toMatchObject({ reason: 'REVOKED' });
  });
});
