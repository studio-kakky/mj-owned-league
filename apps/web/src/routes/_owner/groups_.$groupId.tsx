/**
 * `/groups/$groupId` — グループのダッシュボード (ホーム) (S6, Issue #16 / #58)。
 *
 * Routing note (Issue #58 follow-up):
 *   The file is named `groups_.$groupId` (trailing underscore on the `groups`
 *   segment) so it does NOT nest under the `/groups` list route. `groups.tsx`
 *   renders the list directly without an `<Outlet />`, so a nested child would
 *   never mount — the URL would silently keep showing the list. Un-nesting makes
 *   this a standalone page under the `_owner` shell.
 *
 * Wiring:
 *   - `getGroupHomeServerFn` → route loader. Returns the projected
 *     {@link GroupHomeData}, or `null` for "not found / not yours" which is
 *     surfaced as a redirect to `/groups` (the list is the natural recovery
 *     for a stale id).
 *   - {@link GroupHomeScreen} is purely presentational.
 */

import { createFileRoute, redirect } from '@tanstack/react-router';
import { GroupHomeScreen } from '../../components/group-home';
import { getGroupHomeServerFn } from '../../server/group-home';

const GroupHomePage = () => {
  const { data } = Route.useLoaderData();
  return <GroupHomeScreen data={data} />;
};

export const Route = createFileRoute('/_owner/groups_/$groupId')({
  loader: async ({ params }) => {
    const data = await getGroupHomeServerFn({
      data: { groupId: params.groupId },
    });
    if (data === null) {
      // Stale / cross-owner id. Send the user back to the list rather than
      // rendering a blank page for a group that is not theirs.
      throw redirect({ to: '/groups' });
    }
    return { data };
  },
  component: GroupHomePage,
});
