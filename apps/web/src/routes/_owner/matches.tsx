/**
 * `/matches` — S9 Match 一覧 (`04-screens.md` § S9, Issue #19).
 *
 * Two modes:
 *   - `/matches`            cross-Group list of every Match the Owner has.
 *   - `/matches?leagueId=…` filtered to one League (used from S7 League 詳細).
 *
 * Wiring strategy mirrors `/leagues` (Issue #18):
 *   - This route is the only file that crosses the TanStack Start RPC
 *     boundary. {@link MatchListScreen} takes the projected payload as a
 *     prop and never imports the server functions.
 *   - `listMatchesServerFn` → loader. We thread `?leagueId=` through
 *     `loaderDeps` so the loader re-fetches when the query changes.
 *
 * The doc places the League-scoped list at `/leagues/:leagueId/matches`. For
 * MVP we host the cross-Group list at `/matches` (the bottom-nav target)
 * and consume `?leagueId=…` for scoping — same pattern S10 Match 作成 uses.
 */

import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { MatchListScreen } from '../../components/matches';
import { listMatchesServerFn } from '../../server/match-detail';

const searchSchema = z.object({
  leagueId: z.string().min(1).optional(),
});

export const Route = createFileRoute('/_owner/matches')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ leagueId: search.leagueId }),
  loader: async ({ context, deps }) => {
    const data = await listMatchesServerFn({
      data: {
        ownerId: context.ownerSession.ownerId,
        leagueId: deps.leagueId,
      },
    });
    return { data };
  },
  component: MatchesPage,
});

function MatchesPage() {
  const { data } = Route.useLoaderData();
  return <MatchListScreen matches={data.matches} scope={data.scope} />;
}
