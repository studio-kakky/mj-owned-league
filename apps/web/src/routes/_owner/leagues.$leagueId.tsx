/**
 * `/leagues/$leagueId` — legacy redirect (Issue #60).
 *
 * The League detail moved to `/groups/:groupId/leagues/:leagueId` so it shares
 * the Group namespace with its list (S15). The old flat URL carries no
 * groupId, so we cannot reconstruct the canonical detail path without a lookup;
 * rather than add a round trip for a stale link, we bounce to the active
 * Group's League list (or `/groups` when no Group is active) and let the user
 * re-open the League from there.
 */

import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_owner/leagues/$leagueId')({
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
