/**
 * `/leagues` — S7 / S15 League 一覧 + S8 League 作成 (`04-screens.md`
 * § S7 / S8 / S15, Issue #18).
 *
 * Wiring strategy mirrors `/groups` (Issue #15) and `/` (Issue #14):
 *   - This route file is the only place that crosses the TanStack Start RPC
 *     boundary. The presentational {@link LeagueListScreen} takes the
 *     pre-projected payload as a prop and never imports the server
 *     functions.
 *   - `listLeaguesServerFn` → route loader. Returns leagues + create-modal
 *     options in a single round trip (see `LeagueListData`).
 *   - `createLeagueServerFn` → invoked from the create modal. After
 *     resolution we call `router.invalidate()` so the loader re-fetches and
 *     the new League appears in the list.
 *
 * Why not `/groups/$groupId/leagues`:
 *   The doc places the per-Group list at `/groups/:groupId/leagues` (S15).
 *   For MVP the cross-Group list at `/leagues` is what the bottom nav
 *   already points at, and Owners typically have a small number of Groups
 *   — surfacing every League with a `groupName` label on each card keeps
 *   the page useful without a Group-picker round trip. When per-Group views
 *   become valuable we can add `/groups/$groupId/leagues` as a thin
 *   filter on top of the same loader.
 */

import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useCallback } from 'react';
import { z } from 'zod';
import { type LeagueCreateInput, LeagueListScreen } from '../../components/leagues';
import { createLeagueServerFn, listLeaguesServerFn } from '../../server/leagues';

// Optional `?groupId=` lets callers (S6 Group 詳細) deep-link to "leagues
// scoped to a specific Group". The loader passes the value down to the
// server function which silently drops foreign / unknown ids — keeping the
// page useful even when an Owner pastes a stale link.
const searchSchema = z.object({
  groupId: z.string().min(1).optional(),
});

export const Route = createFileRoute('/_owner/leagues')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ groupId: search.groupId }),
  loader: async ({ context, deps }) => {
    const data = await listLeaguesServerFn({
      data: { ownerId: context.ownerSession.ownerId, groupId: deps.groupId },
    });
    return { data };
  },
  component: LeaguesPage,
});

function LeaguesPage() {
  const router = useRouter();
  const { ownerSession } = Route.useRouteContext();
  const { data } = Route.useLoaderData();

  const handleCreate = useCallback(
    async (input: LeagueCreateInput) => {
      await createLeagueServerFn({
        data: {
          ownerId: ownerSession.ownerId,
          ...input,
        },
      });
      await router.invalidate();
    },
    [ownerSession.ownerId, router],
  );

  return (
    <LeagueListScreen
      leagues={data.leagues}
      groups={data.groups}
      rulesets={data.rulesets}
      onCreateLeague={handleCreate}
    />
  );
}
