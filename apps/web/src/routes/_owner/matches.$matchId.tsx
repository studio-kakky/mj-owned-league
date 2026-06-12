/**
 * `/matches/$matchId` — legacy redirect (Issue #61).
 *
 * The Match 詳細 moved to `/groups/:groupId/matches/:matchId` so it shares the
 * Group namespace with its list (S9). The old flat URL carries no groupId, so
 * we cannot reconstruct the canonical detail path without a lookup; rather than
 * add a round trip for a stale link, we bounce to the active Group's Match list
 * (or `/groups` when no Group is active) and let the user re-open the Match from
 * there.
 */

import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_owner/matches/$matchId')({
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
