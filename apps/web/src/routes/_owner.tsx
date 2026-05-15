/**
 * Pathless layout route for the Owner section.
 *
 * Everything under `routes/_owner/*` renders inside `OwnerShell`. The URL is
 * NOT prefixed with `/_owner` (that is the whole point of the leading
 * underscore in TanStack Router's file convention — see
 * `@tanstack/router-generator/.../utils.js#isSegmentPathless`).
 *
 * Session / active-group wiring — current status:
 *   The Better Auth integration (#7) exposes `/api/auth/*` on the Worker,
 *   but a TanStack Start server-function / loader that turns the cookie
 *   into an `OwnerSession` is NOT yet in place. So for now this layout
 *   passes `session: null`, `activeGroup: null`, `groups: null` — i.e. the
 *   "guest" shape — which the shell tolerates (Issue #11 acceptance
 *   criterion: 未認証状態でも UI が崩れない). Wiring real values is a
 *   follow-up issue, and only requires editing this file.
 */

import { createFileRoute, Outlet } from '@tanstack/react-router';
import { OwnerShell } from '../components/layout';

export const Route = createFileRoute('/_owner')({
  component: OwnerLayout,
});

function OwnerLayout() {
  return (
    <OwnerShell
      session={null}
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
}
