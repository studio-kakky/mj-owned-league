/**
 * `/groups/$groupId/matches` — S9 グループ配下の Match 一覧
 * (`04-screens.md` § S9, Issue #61).
 *
 * Routing note (Issue #58 / #60 / #61):
 *   The file is named `groups_.$groupId.matches` (trailing underscore on the
 *   `groups` segment) so it does NOT nest under the `/groups` list route — the
 *   same pattern as `groups_.$groupId.leagues` (S15). `groups.tsx` renders the
 *   selection list directly without an `<Outlet />`, so a nested child would
 *   never mount. This is a standalone page under the `_owner` shell.
 *
 * Group scoping (Issue #61):
 *   The `groupId` comes solely from the URL path — there is no `?groupId=`
 *   query and no cross-Group fallback. The server function narrows every
 *   projection to that Group and rejects (`null`) a foreign / unknown id; we
 *   surface that as a redirect to `/groups` (the selection screen is the
 *   natural recovery for a stale link).
 *
 *   `?leagueId=` survives as an in-Group filter (the リーグセレクタ chips and
 *   the S7 League detail deep-link use it). The server validates the League
 *   belongs to this Group; a stale id falls back to the Group-wide list.
 *
 * Wiring strategy mirrors the old `/matches` route it replaces:
 *   - This route file is the only place that crosses the TanStack Start RPC
 *     boundary. The presentational {@link MatchListScreen} takes the
 *     pre-projected payload as a prop and never imports the server functions.
 *   - `listMatchesServerFn` → route loader, threaded with `?leagueId=` via
 *     `loaderDeps` so the loader re-fetches when the filter changes.
 */

import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { MatchListScreen } from '../../components/matches';
import { listMatchesServerFn } from '../../server/match-detail';

const searchSchema = z.object({
  leagueId: z.string().min(1).optional(),
});

const MatchesPage = () => {
  const { groupId } = Route.useParams();
  const { data } = Route.useLoaderData();
  return (
    <MatchListScreen
      groupId={groupId}
      matches={data.matches}
      scope={data.scope}
      leagueOptions={data.leagueOptions}
    />
  );
};

export const Route = createFileRoute('/_owner/groups_/$groupId/matches')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ leagueId: search.leagueId }),
  loader: async ({ params, deps }) => {
    const data = await listMatchesServerFn({
      data: { groupId: params.groupId, leagueId: deps.leagueId },
    });
    if (data === null) {
      // Stale / cross-owner groupId. Send the user back to the selection
      // screen rather than rendering an empty list for a Group that is not
      // theirs.
      throw redirect({ to: '/groups' });
    }
    return { data };
  },
  component: MatchesPage,
});
