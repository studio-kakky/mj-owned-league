/**
 * `/groups/$groupId/leagues/$leagueId` — S7 League 詳細
 * (`04-screens.md` § S7, Issue #60).
 *
 * Moved here from the old flat `/leagues/$leagueId` so the League detail lives
 * under the same `/groups/:groupId/...` namespace as its list (S15) and the
 * Group's S6 ホーム. See `groups_.$groupId.leagues.tsx` for the routing /
 * un-nesting rationale.
 *
 * Wiring strategy mirrors the sibling list route:
 *   - `getLeagueDetailServerFn` → route loader. Returns the projected
 *     {@link LeagueDetailData} payload or `null` for "not found / not yours";
 *     we surface `null` as a redirect back to the Group's League list rather
 *     than throwing, because the most common cause is a stale URL the user
 *     pasted from somewhere else.
 *   - The screen is purely presentational; mutations (Match creation, game
 *     input, etc.) are owned by the destination routes (S9 / S11).
 */

import { createFileRoute, redirect } from '@tanstack/react-router';
import { LeagueDetailScreen } from '../../components/leagues';
import { getLeagueDetailServerFn } from '../../server/leagues';

const LeagueDetailPage = () => {
  const { data } = Route.useLoaderData();
  return <LeagueDetailScreen data={data} />;
};

export const Route = createFileRoute('/_owner/groups_/$groupId/leagues/$leagueId')({
  loader: async ({ params }) => {
    const data = await getLeagueDetailServerFn({
      data: { groupId: params.groupId, leagueId: params.leagueId },
    });
    if (data === null) {
      // Stale or cross-owner id, or a League that does not belong to the
      // groupId in the path. Send the user back to that Group's list — the
      // natural recovery point.
      throw redirect({
        to: '/groups/$groupId/leagues',
        params: { groupId: params.groupId },
      });
    }
    return { data };
  },
  component: LeagueDetailPage,
});
