/**
 * Pathless layout route for the Owner section.
 *
 * Everything under `routes/_owner/*` renders inside `OwnerShell`. The URL is
 * NOT prefixed with `/_owner` (that is the whole point of the leading
 * underscore in TanStack Router's file convention — see
 * `@tanstack/router-generator/.../utils.js#isSegmentPathless`).
 *
 * Auth gate (Issue #12):
 *   `beforeLoad` queries Better Auth for the current session and redirects
 *   unauthenticated users to `/login` (S1). This satisfies
 *   `04-screens.md` § S3 "未認証で `/` にアクセスした場合は `/login` へ
 *   リダイレクト" and is mounted on the layout — not on `/_owner/index` —
 *   so every Owner sub-route inherits it without duplication.
 *
 *   Failure mode: if the session probe itself fails (network error /
 *   Worker offline), we err on the side of redirecting to `/login`. Better
 *   to show the sign-in page than to render a half-broken Owner shell.
 *
 * Session / active-group wiring (Issue #58):
 *   `beforeLoad` now resolves the full group list and the persisted active
 *   group alongside the session. The group list comes from
 *   `listGroupsServerFn()`; the active group from `getActiveGroupServerFn()`,
 *   which returns the Owner's stored `activeGroupId`. We reconcile that id
 *   against the live list here — a dangling id (the active Group was deleted
 *   out from under a stale session) resolves to `null` ("no selection"), which
 *   matches the schema's `onDelete: 'set null'` intent for the in-memory path
 *   and defends the D1 path where `ALTER TABLE ADD COLUMN` cannot carry the FK
 *   action.
 *
 *   The selection callback lives in the component (it needs the router): it
 *   persists the choice via `setActiveGroupServerFn`, navigates to the Group's
 *   S6 ホーム, then invalidates so the header re-reads the new active group.
 */

import { createFileRoute, Outlet, redirect, useNavigate, useRouter } from '@tanstack/react-router';
import { useCallback } from 'react';
import { OwnerShell } from '../components/layout';
import type { GroupSummary, OwnerSession } from '../components/layout/types';
import { getActiveGroupServerFn, setActiveGroupServerFn } from '../server/active-group';
import { listGroupsServerFn } from '../server/groups';
import { getSessionServerFn } from '../server/session';

const OwnerLayout = () => {
  const router = useRouter();
  const navigate = useNavigate();
  const { ownerSession, groups, activeGroup } = Route.useRouteContext();

  const handleSelectGroup = useCallback(
    async (groupId: string) => {
      const result = await setActiveGroupServerFn({ data: { groupId } });
      if (!result.ok) {
        // Stale id (the Group vanished / is not ours). Re-read so the header
        // and switcher reflect the real list instead of navigating blindly.
        await router.invalidate();
        return;
      }
      await navigate({ to: '/groups/$groupId', params: { groupId } });
      // Invalidate so the layout's `beforeLoad` re-runs and the header shows
      // the newly-selected group as active on the next render.
      await router.invalidate();
    },
    [router, navigate],
  );

  return (
    <OwnerShell
      session={ownerSession}
      activeGroup={activeGroup}
      groups={groups}
      onSelectGroup={handleSelectGroup}
    >
      <Outlet />
    </OwnerShell>
  );
};

export const Route = createFileRoute('/_owner')({
  beforeLoad: async () => {
    let user: Awaited<ReturnType<typeof getSessionServerFn>> = null;
    try {
      user = await getSessionServerFn();
    } catch {
      // Network or Worker-side failure. Treat as unauthenticated — the
      // user will see the login page rather than a partially-rendered
      // dashboard. The actual error stays visible in the browser console
      // via Better Auth's own logging.
      throw redirect({ to: '/login' });
    }

    if (!user) {
      throw redirect({ to: '/login' });
    }

    const ownerSession: OwnerSession = {
      ownerId: user.id,
      // `user.name` is what Better Auth populates from Google's `name`
      // claim. When it is empty (extremely rare with Google but possible
      // with other providers), fall back to the local-part of the email.
      displayName: user.name.trim().length ? user.name : (user.email.split('@')[0] ?? 'Owner'),
    };

    // Resolve the group list + active group for the shell header / switcher.
    // Both are server functions that run server-side during SSR and as RPCs on
    // client navigations, so the cookie-backed session is always available.
    const [groupItems, activeGroupId] = await Promise.all([
      listGroupsServerFn(),
      getActiveGroupServerFn(),
    ]);

    const groups: ReadonlyArray<GroupSummary> = groupItems.map((g) => ({
      id: g.id,
      name: g.name,
    }));

    // Reconcile the stored id against the live list. A dangling id resolves to
    // null ("no selection") so the header never points at a missing Group.
    const activeGroup: GroupSummary | null =
      activeGroupId === null ? null : (groups.find((g) => g.id === activeGroupId) ?? null);

    return { ownerSession, groups, activeGroup };
  },
  component: OwnerLayout,
});
