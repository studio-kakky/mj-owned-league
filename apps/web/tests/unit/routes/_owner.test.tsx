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
const listGroups = vi.fn();
const getActiveGroup = vi.fn();

vi.mock('../../../src/server/session', () => ({
  getSessionServerFn: (...args: unknown[]) => getSession(...args),
}));

// The layout's `beforeLoad` now resolves the group list + active group via
// these server functions (Issue #58). They import `cloudflare:workers`, which
// vitest/jsdom cannot resolve, so we mock them and drive their return values.
vi.mock('../../../src/server/groups', () => ({
  listGroupsServerFn: (...args: unknown[]) => listGroups(...args),
}));

vi.mock('../../../src/server/active-group', () => ({
  getActiveGroupServerFn: (...args: unknown[]) => getActiveGroup(...args),
  setActiveGroupServerFn: vi.fn(),
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
  useRouter: () => ({ invalidate: vi.fn() }),
  useNavigate: () => vi.fn(),
}));

vi.mock('../../../src/components/layout', () => ({
  OwnerShell: () => null,
}));

import { beforeEach } from 'vitest';
import { Route } from '../../../src/routes/_owner';

const beforeLoad = (Route as unknown as { beforeLoad: () => Promise<unknown> }).beforeLoad;

type BeforeLoadResult = {
  ownerSession: { ownerId: string; displayName: string };
  groups: ReadonlyArray<{ id: string; name: string }>;
  activeGroup: { id: string; name: string } | null;
};

beforeEach(() => {
  getSession.mockReset();
  listGroups.mockReset();
  getActiveGroup.mockReset();
  // Sensible defaults for the signed-in branch; individual tests override.
  listGroups.mockResolvedValue([]);
  getActiveGroup.mockResolvedValue(null);
});

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

    const result = (await beforeLoad()) as BeforeLoadResult;
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

    const result = (await beforeLoad()) as BeforeLoadResult;
    expect(result.ownerSession.displayName).toBe('someone');
  });

  describe('active-group resolution (Issue #58)', () => {
    const signedIn = () =>
      getSession.mockResolvedValueOnce({
        id: 'owner-1',
        name: 'Test Owner',
        email: 'owner@example.com',
      });

    it('projects the group list into id/name summaries', async () => {
      signedIn();
      listGroups.mockResolvedValueOnce([
        {
          id: 'g1',
          name: '金曜定例会',
          playerCount: 2,
          leagueCount: 1,
          lastPlayedAt: null,
          hasHistory: false,
        },
        {
          id: 'g2',
          name: '会社の同期会',
          playerCount: 0,
          leagueCount: 0,
          lastPlayedAt: null,
          hasHistory: false,
        },
      ]);
      getActiveGroup.mockResolvedValueOnce(null);

      const result = (await beforeLoad()) as BeforeLoadResult;
      expect(result.groups).toEqual([
        { id: 'g1', name: '金曜定例会' },
        { id: 'g2', name: '会社の同期会' },
      ]);
    });

    it('resolves the active group by matching the stored id against the list', async () => {
      signedIn();
      listGroups.mockResolvedValueOnce([
        {
          id: 'g1',
          name: '金曜定例会',
          playerCount: 0,
          leagueCount: 0,
          lastPlayedAt: null,
          hasHistory: false,
        },
        {
          id: 'g2',
          name: '会社の同期会',
          playerCount: 0,
          leagueCount: 0,
          lastPlayedAt: null,
          hasHistory: false,
        },
      ]);
      getActiveGroup.mockResolvedValueOnce('g2');

      const result = (await beforeLoad()) as BeforeLoadResult;
      expect(result.activeGroup).toEqual({ id: 'g2', name: '会社の同期会' });
    });

    it('treats a dangling active-group id (not in the list) as no selection', async () => {
      signedIn();
      listGroups.mockResolvedValueOnce([
        {
          id: 'g1',
          name: '金曜定例会',
          playerCount: 0,
          leagueCount: 0,
          lastPlayedAt: null,
          hasHistory: false,
        },
      ]);
      // The stored id points at a group that no longer exists / is not listed.
      getActiveGroup.mockResolvedValueOnce('deleted-group');

      const result = (await beforeLoad()) as BeforeLoadResult;
      expect(result.activeGroup).toBeNull();
    });

    it('resolves to null when no active group is stored', async () => {
      signedIn();
      listGroups.mockResolvedValueOnce([
        {
          id: 'g1',
          name: '金曜定例会',
          playerCount: 0,
          leagueCount: 0,
          lastPlayedAt: null,
          hasHistory: false,
        },
      ]);
      getActiveGroup.mockResolvedValueOnce(null);

      const result = (await beforeLoad()) as BeforeLoadResult;
      expect(result.activeGroup).toBeNull();
    });
  });
});
