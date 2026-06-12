/**
 * `/matches` — legacy redirect (Issue #61).
 *
 * The cross-Group Match list used to live here. Issue #61 moved the list under
 * the Group namespace (`/groups/:groupId/matches`, S9) so it shares a namespace
 * with the Group's S6 ホーム and the per-Group League / Settings screens. This
 * stub keeps old links / bookmarks alive by bouncing them to the active Group's
 * list — or to `/groups` (the selection screen) when no Group is active.
 *
 * The active Group comes from the `_owner` layout's route context (resolved in
 * its `beforeLoad`), so the redirect needs no round trip of its own.
 */

import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_owner/matches')({
  beforeLoad: ({ context }) => {
    const activeGroup = context.activeGroup;
    if (activeGroup === null) {
      throw redirect({ to: '/groups' });
    }
    throw redirect({
      to: '/groups/$groupId/matches',
      params: { groupId: activeGroup.id },
    });
  },
});
