/**
 * `/leagues/$leagueId` — S7 League 詳細 (`04-screens.md` § S7, Issue #18).
 *
 * Wiring strategy mirrors `/leagues` (the sibling list route):
 *   - `getLeagueDetailServerFn` → route loader. Returns the projected
 *     {@link LeagueDetailData} payload or `null` for "not found / not
 *     yours"; we surface `null` as a 404-ish redirect to the list rather
 *     than throwing, because the most common cause is a stale URL the
 *     user pasted from somewhere else.
 *   - The screen is purely presentational; mutations (Match creation,
 *     game input, etc.) are owned by the destination routes (S9 / S11).
 */

import { createFileRoute, redirect } from '@tanstack/react-router';
import { LeagueDetailScreen } from '../../components/leagues';
import { getLeagueDetailServerFn } from '../../server/leagues';

const LeagueDetailPage = () => {
  const { data } = Route.useLoaderData();
  return <LeagueDetailScreen data={data} />;
};

export const Route = createFileRoute('/_owner/leagues/$leagueId')({
  loader: async ({ params }) => {
    const data = await getLeagueDetailServerFn({
      data: { leagueId: params.leagueId },
    });
    if (data === null) {
      // Stale or cross-owner id. Send the user back to the list rather than
      // rendering a "not found" page — the list is the natural recovery.
      throw redirect({ to: '/leagues' });
    }
    return { data };
  },
  component: LeagueDetailPage,
});
