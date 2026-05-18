/**
 * `/matches/new` — S10 Match 作成 (`04-screens.md` § S10,
 * `03-user-flow.md` § F5, Issue #20).
 *
 * Routing decisions:
 *   - The doc lists two path-parametrised aliases
 *     (`/leagues/:leagueId/matches/new`, `/groups/:groupId/matches/new`).
 *     For MVP we host a single cross-Group page at `/matches/new` and
 *     consume the context via `?leagueId=…` / `?groupId=…` query params.
 *     Two reasons:
 *       1. The bottom-nav "マッチ" tab already points at `/matches`, so
 *          the create page lives one segment under it without a new
 *          top-level route.
 *       2. The two path variants would otherwise need parallel route
 *          files re-rendering the same {@link MatchCreateScreen}; the
 *          query-param form keeps a single source of truth and makes the
 *          server function input shape symmetrical.
 *     Adding the path aliases later is a thin redirect — no contract
 *     change.
 *
 *   - The form is hosted under the `_owner` layout so the bottom-nav and
 *     auth gate are inherited unchanged.
 *
 * Loader vs. action:
 *   - `loader` calls `getMatchCreateContextServerFn`, which performs all
 *     ownership filtering and computes the next `sequenceNumber` when a
 *     `leagueId` is supplied. The loader runs once per visit; the
 *     component receives a fully-typed snapshot via
 *     `Route.useLoaderData()`.
 *   - Submission happens through `createMatchServerFn` from the
 *     component-level callback. On success we navigate to the originating
 *     League detail (when one was set) or the Matches placeholder, with a
 *     `router.invalidate()` so the upstream lists reflect the new row.
 *
 * Cancel UX:
 *   We send the user back to whichever screen they came from. TanStack
 *   Router does not expose a low-noise "back" primitive yet, so we
 *   approximate it with `useRouter().history.back()` when the browser has
 *   history; otherwise we fall back to the same destination the success
 *   path uses.
 */

import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useCallback } from 'react';
import { z } from 'zod';
import type { MatchCreateInput } from '../../components/matches';
import { MatchCreateScreen } from '../../components/matches';
import { createMatchServerFn, getMatchCreateContextServerFn } from '../../server/matches';

const searchSchema = z.object({
  /** Pin the form to a specific League. Falls back to the cross-Group form when foreign / stale. */
  leagueId: z.string().min(1).optional(),
  /** Pin the form to a specific Group. */
  groupId: z.string().min(1).optional(),
});

const MatchCreatePage = () => {
  const router = useRouter();
  const { ownerSession } = Route.useRouteContext();
  const { data } = Route.useLoaderData();

  const handleSubmit = useCallback(
    async (input: MatchCreateInput) => {
      const created = await createMatchServerFn({
        data: { ownerId: ownerSession.ownerId, ...input },
      });
      await router.invalidate();
      if (created.leagueId !== null) {
        await router.navigate({
          to: '/leagues/$leagueId',
          params: { leagueId: created.leagueId },
        });
        return;
      }
      // No League context — drop the user back on the Matches list. The
      // dedicated /matches/$matchId detail (S9) is not implemented yet.
      await router.navigate({ to: '/matches' });
    },
    [ownerSession.ownerId, router],
  );

  const handleCancel = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.history.back();
      return;
    }
    if (data.initialLeagueId !== null) {
      void router.navigate({
        to: '/leagues/$leagueId',
        params: { leagueId: data.initialLeagueId },
      });
      return;
    }
    void router.navigate({ to: '/matches' });
  }, [data.initialLeagueId, router]);

  return <MatchCreateScreen data={data} onSubmit={handleSubmit} onCancel={handleCancel} />;
};

export const Route = createFileRoute('/_owner/matches/new')({
  validateSearch: searchSchema,
  // We must thread `search` into the loader manually because TanStack
  // Router does not feed validated search into `loader` by default — only
  // `loaderDeps` does. Deps are also what makes the loader re-run when the
  // query changes (e.g. the user picks a different League from a related
  // dropdown elsewhere).
  loaderDeps: ({ search }) => ({ leagueId: search.leagueId, groupId: search.groupId }),
  loader: async ({ context, deps }) => {
    const data = await getMatchCreateContextServerFn({
      data: {
        ownerId: context.ownerSession.ownerId,
        leagueId: deps.leagueId,
        groupId: deps.groupId,
      },
    });
    return { data };
  },
  component: MatchCreatePage,
});
