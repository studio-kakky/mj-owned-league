/**
 * `/groups/$groupId` — S6 Group 詳細 (ホーム) (`04-screens.md` § S6, Issue #16).
 *
 * Wiring strategy mirrors `/leagues/$leagueId` (Issue #18):
 *   - `getGroupHomeServerFn` → route loader. Returns the projected
 *     {@link GroupHomeData} payload, or `null` for "not found / not
 *     yours". `null` is surfaced as a redirect to `/groups` rather than a
 *     thrown error — the list is the natural recovery for a stale id.
 *   - The screen is purely presentational. Every navigation affordance
 *     (League / Match / Settings deep links) goes through TanStack Router
 *     `<Link>`s declared inside the component, so the route file stays a
 *     thin loader-only file.
 *
 * Why we don't accept any `?search=` params here:
 *   The path itself carries the only required input. Any "filtered" view
 *   (e.g. "leagues for this Group") lives on the destination screen
 *   (`/leagues?groupId=…`); this page is the俯瞰ハブ that hands off to
 *   those screens.
 */

import { createFileRoute, redirect } from '@tanstack/react-router';
import { GroupHomeScreen } from '../../components/group-home';
import { getGroupHomeServerFn } from '../../server/group-home';

const GroupHomePage = () => {
  const { data } = Route.useLoaderData();
  return <GroupHomeScreen data={data} />;
};

export const Route = createFileRoute('/_owner/groups/$groupId')({
  loader: async ({ params }) => {
    const data = await getGroupHomeServerFn({
      data: { groupId: params.groupId },
    });
    if (data === null) {
      // Stale / cross-owner id. Send the user back to the list rather than
      // rendering a "not found" page — same convention as S7 detail.
      throw redirect({ to: '/groups' });
    }
    return { data };
  },
  component: GroupHomePage,
});
