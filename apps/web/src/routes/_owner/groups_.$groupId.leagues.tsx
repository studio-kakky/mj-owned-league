/**
 * `/groups/$groupId/leagues` — S15 グループ配下の League 一覧 + S8 League 作成
 * (`04-screens.md` § S15 / S8, Issue #60).
 *
 * Routing note (Issue #58 / #60 follow-up):
 *   The file is named `groups_.$groupId.leagues` (trailing underscore on the
 *   `groups` segment) so it does NOT nest under the `/groups` list route — the
 *   same pattern as `groups_.$groupId` (the S6 ホーム). `groups.tsx` renders
 *   the selection list directly without an `<Outlet />`, so a nested child
 *   would never mount. This is a standalone page under the `_owner` shell, NOT
 *   a child of the list / ホーム layout.
 *
 * Group scoping (Issue #60):
 *   The `groupId` comes solely from the URL path — there is no `?groupId=`
 *   query and no cross-Group fallback. The server function narrows every
 *   projection to that Group and rejects (`null`) a foreign / unknown id; we
 *   surface that as a redirect to `/groups` (the selection screen is the
 *   natural recovery for a stale link).
 *
 * Wiring strategy mirrors the old `/leagues` route it replaces:
 *   - This route file is the only place that crosses the TanStack Start RPC
 *     boundary. The presentational {@link LeagueListScreen} takes the
 *     pre-projected payload as a prop and never imports the server functions.
 *   - `listLeaguesServerFn` → route loader. Returns leagues + create-modal
 *     options in a single round trip (see `LeagueListData`).
 *   - `createLeagueServerFn` → invoked from the create modal. After resolution
 *     we call `router.invalidate()` so the loader re-fetches and the new
 *     League appears in the list.
 */

import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { useCallback } from 'react';
import { type LeagueCreateInput, LeagueListScreen } from '../../components/leagues';
import { createLeagueServerFn, listLeaguesServerFn } from '../../server/leagues';

const LeaguesPage = () => {
  const router = useRouter();
  const { groupId } = Route.useParams();
  const { data } = Route.useLoaderData();

  const handleCreate = useCallback(
    async (input: LeagueCreateInput) => {
      await createLeagueServerFn({ data: input });
      await router.invalidate();
    },
    [router],
  );

  return (
    <LeagueListScreen
      groupId={groupId}
      leagues={data.leagues}
      groups={data.groups}
      rulesets={data.rulesets}
      onCreateLeague={handleCreate}
    />
  );
};

export const Route = createFileRoute('/_owner/groups_/$groupId/leagues')({
  loader: async ({ params }) => {
    const data = await listLeaguesServerFn({ data: { groupId: params.groupId } });
    if (data === null) {
      // Stale / cross-owner groupId. Send the user back to the selection
      // screen rather than rendering an empty list for a Group that is not
      // theirs.
      throw redirect({ to: '/groups' });
    }
    return { data };
  },
  component: LeaguesPage,
});
