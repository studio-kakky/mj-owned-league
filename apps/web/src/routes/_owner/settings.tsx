/**
 * `/settings` — legacy redirect (Issue #62).
 *
 * The Settings screen used to live here, scoped to the Owner's "first" Group.
 * Issue #62 moved it under the Group namespace (`/groups/:groupId/settings`,
 * S16) so it shares a namespace with the Group's S6 ホーム and the per-Group
 * League (S15) / Match (S9) screens, and dropped the implicit first-group
 * fallback. This stub keeps old links / bookmarks alive by bouncing them to
 * the active Group's Settings — or to `/groups` (the selection screen) when no
 * Group is active.
 *
 * The active Group comes from the `_owner` layout's route context (resolved in
 * its `beforeLoad`), so the redirect needs no round trip of its own. Mirrors
 * the `/leagues` and `/matches` legacy stubs.
 */

import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_owner/settings')({
  beforeLoad: ({ context }) => {
    const activeGroup = context.activeGroup;
    if (activeGroup === null) {
      throw redirect({ to: '/groups' });
    }
    throw redirect({
      to: '/groups/$groupId/settings',
      params: { groupId: activeGroup.id },
    });
  },
});
