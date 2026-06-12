/**
 * `/groups/$groupId/matches/new` — S10 Match 作成
 * (`04-screens.md` § S10, `03-user-flow.md` § F5, Issue #61).
 *
 * Moved here from the old flat `/matches/new` so the create form lives under
 * the same `/groups/:groupId/...` namespace as its list (S9). See
 * `groups_.$groupId.matches.tsx` for the routing / un-nesting rationale.
 *
 * Group scoping (Issue #61):
 *   The `groupId` comes solely from the URL path — there is no `?groupId=`
 *   query. The create handler always derives the Group from the submitted
 *   `MatchCreateInput.groupId`, which the screen pins to the path Group. The
 *   loader returns `null` for a foreign / unknown id; we redirect to `/groups`.
 *
 *   `?leagueId=` survives as an in-Group pin — when the user arrived from S7
 *   League detail the form locks the League selector (and `format`). A League
 *   outside this Group is silently dropped to the League 外 variant.
 *
 * Loader vs. action:
 *   - `loader` calls `getMatchCreateContextServerFn`, which performs the
 *     ownership check and computes the next `sequenceNumber` when a `leagueId`
 *     is supplied. The component receives a fully-typed snapshot via
 *     `Route.useLoaderData()`.
 *   - Submission happens through `createMatchServerFn` from a component-level
 *     callback. On success we navigate to the originating League detail (when
 *     one was set) or this Group's Match list, with a `router.invalidate()` so
 *     the upstream lists reflect the new row.
 *
 * Cancel UX:
 *   We send the user back to whichever screen they came from via
 *   `useRouter().history.back()` when the browser has history; otherwise we
 *   fall back to the same destination the success path uses.
 */

import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { useCallback } from 'react';
import { z } from 'zod';
import type { MatchCreateInput } from '../../components/matches';
import { MatchCreateScreen } from '../../components/matches';
import { createMatchServerFn, getMatchCreateContextServerFn } from '../../server/matches';

const searchSchema = z.object({
  /** Pin the form to a specific League in this Group. Falls back to League 外 when foreign / stale. */
  leagueId: z.string().min(1).optional(),
});

const MatchCreatePage = () => {
  const router = useRouter();
  const { groupId } = Route.useParams();
  const { data } = Route.useLoaderData();

  const handleSubmit = useCallback(
    async (input: MatchCreateInput) => {
      const created = await createMatchServerFn({ data: input });
      await router.invalidate();
      if (created.leagueId !== null) {
        await router.navigate({
          to: '/groups/$groupId/leagues/$leagueId',
          params: { groupId, leagueId: created.leagueId },
        });
        return;
      }
      await router.navigate({ to: '/groups/$groupId/matches', params: { groupId } });
    },
    [groupId, router],
  );

  const handleCancel = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.history.back();
      return;
    }
    if (data.initialLeagueId !== null) {
      void router.navigate({
        to: '/groups/$groupId/leagues/$leagueId',
        params: { groupId, leagueId: data.initialLeagueId },
      });
      return;
    }
    void router.navigate({ to: '/groups/$groupId/matches', params: { groupId } });
  }, [data.initialLeagueId, groupId, router]);

  return <MatchCreateScreen data={data} onSubmit={handleSubmit} onCancel={handleCancel} />;
};

export const Route = createFileRoute('/_owner/groups_/$groupId/matches/new')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ leagueId: search.leagueId }),
  loader: async ({ params, deps }) => {
    const data = await getMatchCreateContextServerFn({
      data: { groupId: params.groupId, leagueId: deps.leagueId },
    });
    if (data === null) {
      throw redirect({ to: '/groups' });
    }
    return { data };
  },
  component: MatchCreatePage,
});
