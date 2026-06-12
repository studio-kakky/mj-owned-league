/**
 * `/leagues` — legacy redirect (Issue #60).
 *
 * The cross-Group League list used to live here. Issue #60 moved the list
 * under the Group namespace (`/groups/:groupId/leagues`, S15) so it shares a
 * namespace with the Group's S6 ホーム and the per-Group Match / Settings
 * screens. This stub keeps old links / bookmarks alive by bouncing them to the
 * active Group's list — or to `/groups` (the selection screen) when no Group
 * is active.
 *
 * The active Group comes from the `_owner` layout's route context (resolved in
 * its `beforeLoad`), so the redirect needs no round trip of its own.
 */

import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_owner/leagues')({
  beforeLoad: ({ context }) => {
    const activeGroup = context.activeGroup;
    if (activeGroup === null) {
      throw redirect({ to: '/groups' });
    }
    throw redirect({
      to: '/groups/$groupId/leagues',
      params: { groupId: activeGroup.id },
    });
  },
});
