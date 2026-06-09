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
 * Session / active-group wiring — current status:
 *   `beforeLoad` returns the raw Better Auth session shape, but the active
 *   group and the full group list still need a dedicated loader. So
 *   `OwnerShell` is still rendered with `activeGroup: null` /
 *   `groups: null`; only the `session` prop is now populated. Wiring active
 *   group is a follow-up issue.
 */

import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { OwnerShell } from '../components/layout';
import type { OwnerSession } from '../components/layout/types';
import { getSessionServerFn } from '../server/session';

const OwnerLayout = () => {
  const { ownerSession } = Route.useRouteContext();

  return (
    <OwnerShell
      session={ownerSession}
      activeGroup={null}
      groups={null}
      onSelectGroup={() => {
        // No-op until the layout receives a real list of groups; see the
        // "Session / active-group wiring" note above.
      }}
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

    return { ownerSession };
  },
  component: OwnerLayout,
});
