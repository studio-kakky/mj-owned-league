/**
 * Tests for the Owner layout's `beforeLoad` auth gate (Issue #12 AC:
 * "未認証で `/` にアクセスすると `/login` にリダイレクト").
 *
 * The redirect is driven by `getSessionServerFn()` (the server-side session
 * probe) + TanStack Router's `redirect()` thrown helper. We stub both so we
 * can drive the three branches:
 *   1. session is `null` → redirect to `/login`
 *   2. session exists → returns `{ ownerSession }` for the layout
 *   3. session probe throws → redirect to `/login` (defensive)
 *
 * Note: `getSessionServerFn` already projects Better Auth's session down to a
 * flat `{ id, email, name } | null` (see `src/server/session.ts`), so the mock
 * resolves that shape directly rather than Better Auth's `{ data: { user } }`.
 */

import { describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();

vi.mock('../../../src/server/session', () => ({
  getSessionServerFn: (...args: unknown[]) => getSession(...args),
}));

// `redirect()` in TanStack Router throws a sentinel object; we replicate
// that shape so the route's `throw redirect(...)` is observable to the
// test. We also stub `createFileRoute` so the module loads without a real
// router context.
class RedirectSentinel extends Error {
  constructor(public readonly target: { to: string }) {
    super(`redirect:${target.to}`);
  }
}

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: unknown) => config,
  redirect: (target: { to: string }) => new RedirectSentinel(target),
  Outlet: () => null,
}));

vi.mock('../../../src/components/layout', () => ({
  OwnerShell: () => null,
}));

import { Route } from '../../../src/routes/_owner';

const beforeLoad = (Route as unknown as { beforeLoad: () => Promise<unknown> }).beforeLoad;

describe('Owner layout beforeLoad', () => {
  it('redirects to /login when the session is null', async () => {
    getSession.mockResolvedValueOnce(null);

    await expect(beforeLoad()).rejects.toMatchObject({
      target: { to: '/login' },
    });
  });

  it('redirects to /login when the session probe throws', async () => {
    getSession.mockRejectedValueOnce(new Error('worker offline'));

    await expect(beforeLoad()).rejects.toMatchObject({
      target: { to: '/login' },
    });
  });

  it('returns an OwnerSession when the user is signed in', async () => {
    getSession.mockResolvedValueOnce({
      id: 'owner-1',
      name: 'Test Owner',
      email: 'owner@example.com',
    });

    const result = (await beforeLoad()) as {
      ownerSession: { ownerId: string; displayName: string };
    };
    expect(result.ownerSession).toEqual({
      ownerId: 'owner-1',
      displayName: 'Test Owner',
    });
  });

  it('falls back to the email local-part when the user has no name', async () => {
    getSession.mockResolvedValueOnce({
      id: 'owner-2',
      name: '',
      email: 'someone@example.com',
    });

    const result = (await beforeLoad()) as {
      ownerSession: { ownerId: string; displayName: string };
    };
    expect(result.ownerSession.displayName).toBe('someone');
  });
});
