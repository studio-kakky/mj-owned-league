/**
 * Tests for the `/invitations` server-function handlers (Issue #21).
 *
 * We exercise the handlers directly rather than the `createServerFn`
 * wrappers, same as the `/groups` and `/` (dashboard) server tests. Each
 * test resets the module-level store via `resetGroupServerStoreForTests`.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  getGroupServerStore,
  resetGroupServerStoreForTests,
} from '../../../src/server/groups-store';
import {
  issueInvitationHandler,
  listInvitationsHandler,
  revokeInvitationHandler,
} from '../../../src/server/invitations';
import { InvitationInvalidError } from '../../../src/services/errors';

const owner = 'owner-test-1';
const otherOwner = 'owner-test-2';

beforeEach(() => {
  resetGroupServerStoreForTests();
});

// The dev seed places one PENDING invitation (`dev-${owner}-invitation-1`)
// with `expiresAt = 2099-01-01`. We pin `now` well before that so the
// seeded invitation projects as PENDING (not EXPIRED).
const fixedNow = new Date('2026-05-15T00:00:00.000Z');

describe('listInvitationsHandler', () => {
  it('materialises the dev seed and returns the seeded invitation as PENDING', async () => {
    const result = await listInvitationsHandler({ ownerId: owner }, { now: () => fixedNow });

    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe('PENDING');
    expect(result[0]?.memo).toBe('次回参加候補');
  });

  it('isolates listings by ownerId', async () => {
    await listInvitationsHandler({ ownerId: owner });
    const others = await listInvitationsHandler({ ownerId: otherOwner }, { now: () => fixedNow });
    // Other owner sees their own seeded invitation, not the first owner's.
    expect(others).toHaveLength(1);
    expect(others[0]?.id).toBe(`dev-${otherOwner}-invitation-1`);
  });

  it('projects an expired PENDING row as the EXPIRED ui status', async () => {
    // Pin "now" past the seeded expiry would require rewriting the seed
    // (2099-01-01). Instead, issue a fresh invitation with a short TTL and
    // re-list with a future clock.
    await issueInvitationHandler({ ownerId: owner }, { now: () => fixedNow });
    // Hand-rewrite the just-issued invitation's expiresAt so it is in the
    // past relative to our future clock. We reach into the store directly
    // — the alternative is exposing a TTL knob through the handler which
    // is only useful for tests.
    const store = getGroupServerStore();
    const target = [...store.invitations.values()].find(
      (i) => i.issuedByOwnerId === owner && i.id !== `dev-${owner}-invitation-1`,
    );
    if (target) {
      store.invitations.set(target.id, {
        ...target,
        expiresAt: '2026-05-10T00:00:00.000Z',
      });
    }

    const future = new Date('2026-05-20T00:00:00.000Z');
    const result = await listInvitationsHandler({ ownerId: owner }, { now: () => future });

    const expired = result.find((r) => r.id === target?.id);
    expect(expired?.status).toBe('EXPIRED');
  });

  it('sorts invitations newest-first by createdAt', async () => {
    // Issue two invitations with explicit, monotonically-increasing createdAt
    // values by writing them straight into the store. The dev seed materialise
    // hook is bypassed here because the seed Invitation's createdAt is
    // `new Date().toISOString()` (= "test wall-clock now"), which collides
    // with handler-issued rows that also use real wall-clock — making the
    // tail-of-list assertion racy. Sorting is the unit under test, so we
    // hand-place rows with stable timestamps and assert the result order.
    const store = getGroupServerStore();
    store.invitations.set('older', {
      id: 'older',
      issuedByOwnerId: owner,
      memo: 'older',
      token: 'tok-older',
      status: 'PENDING',
      expiresAt: '2099-01-01T00:00:00.000Z',
      consumedByUserId: null,
      consumedAt: null,
      revokedAt: null,
      createdAt: '2026-05-10T00:00:00.000Z',
    });
    store.invitations.set('newer', {
      id: 'newer',
      issuedByOwnerId: owner,
      memo: 'newer',
      token: 'tok-newer',
      status: 'PENDING',
      expiresAt: '2099-01-01T00:00:00.000Z',
      consumedByUserId: null,
      consumedAt: null,
      revokedAt: null,
      createdAt: '2026-05-14T00:00:00.000Z',
    });

    const result = await listInvitationsHandler({ ownerId: owner }, { now: () => fixedNow });
    // Newest first.
    const ids = result.map((r) => r.id);
    expect(ids.indexOf('newer')).toBeLessThan(ids.indexOf('older'));
  });
});

describe('issueInvitationHandler', () => {
  it('creates a new PENDING invitation and returns the token + projection', async () => {
    const result = await issueInvitationHandler(
      { ownerId: owner, memo: '田中さん' },
      { now: () => fixedNow },
    );

    expect(result.token).toBeDefined();
    expect(result.invitation.status).toBe('PENDING');
    expect(result.invitation.memo).toBe('田中さん');
  });

  it('normalises an empty memo to null', async () => {
    const result = await issueInvitationHandler(
      { ownerId: owner, memo: '' },
      { now: () => fixedNow },
    );
    expect(result.invitation.memo).toBeNull();
  });

  it('omits memo when not provided', async () => {
    const result = await issueInvitationHandler({ ownerId: owner }, { now: () => fixedNow });
    expect(result.invitation.memo).toBeNull();
  });
});

describe('revokeInvitationHandler', () => {
  it('revokes a PENDING invitation owned by the caller', async () => {
    const issued = await issueInvitationHandler({ ownerId: owner }, { now: () => fixedNow });
    const result = await revokeInvitationHandler(
      { ownerId: owner, invitationId: issued.invitation.id },
      { now: () => fixedNow },
    );
    expect(result.revoked).toBe(true);
    expect(result.invitation.status).toBe('REVOKED');
  });

  it('rejects revocation of an invitation belonging to another owner', async () => {
    const issued = await issueInvitationHandler({ ownerId: owner }, { now: () => fixedNow });

    await expect(
      revokeInvitationHandler(
        { ownerId: otherOwner, invitationId: issued.invitation.id },
        { now: () => fixedNow },
      ),
    ).rejects.toMatchObject({
      constructor: InvitationInvalidError,
      reason: 'NOT_FOUND',
    });

    // The original invitation is untouched.
    const list = await listInvitationsHandler({ ownerId: owner }, { now: () => fixedNow });
    const same = list.find((r) => r.id === issued.invitation.id);
    expect(same?.status).toBe('PENDING');
  });

  it('rejects revocation of a missing invitation with NOT_FOUND', async () => {
    await expect(
      revokeInvitationHandler(
        { ownerId: owner, invitationId: 'does-not-exist' },
        { now: () => fixedNow },
      ),
    ).rejects.toMatchObject({
      constructor: InvitationInvalidError,
      reason: 'NOT_FOUND',
    });
  });
});
