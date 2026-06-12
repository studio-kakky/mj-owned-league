/**
 * `/groups/$groupId/matches/$matchId` — S9 Match 詳細 + S11-S13 対局 CRUD
 * (`04-screens.md` § S9 / S11 / S12 / S13, Issue #61).
 *
 * Moved here from the old flat `/matches/$matchId` so the detail lives under
 * the same `/groups/:groupId/...` namespace as its list (S9). See
 * `groups_.$groupId.matches.tsx` for the routing / un-nesting rationale.
 *
 * Wiring strategy mirrors the sibling League detail route (Issue #60):
 *   - `getMatchDetailServerFn` → loader. Returns `null` for not-found /
 *     cross-Owner, or a Match that does not belong to the `groupId` in the
 *     path; we surface that as a redirect to this Group's Match list.
 *   - Game submit / delete are owned by callbacks on the screen. They go
 *     through `submitGameServerFn` / `deleteGameServerFn` and then
 *     `router.invalidate()` so the ranking / list re-renders without a
 *     manual refetch.
 *   - The presentational {@link MatchDetailScreen} hosts the S11 / S12 / S13
 *     modals internally; this route file never sees the modal state.
 */

import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { useCallback } from 'react';
import type { GameSubmitInput } from '../../components/matches';
import { MatchDetailScreen } from '../../components/matches';
import {
  bridgeGameSubmit,
  deleteGameServerFn,
  getMatchDetailServerFn,
  submitGameServerFn,
} from '../../server/match-detail';

const MatchDetailPage = () => {
  const router = useRouter();
  const { data } = Route.useLoaderData();

  const handleSubmitGame = useCallback(
    async (input: GameSubmitInput) => {
      await submitGameServerFn({ data: bridgeGameSubmit(input) });
      await router.invalidate();
    },
    [router],
  );

  const handleDeleteGame = useCallback(
    async (gameId: string) => {
      await deleteGameServerFn({ data: { gameId } });
      await router.invalidate();
    },
    [router],
  );

  return (
    <MatchDetailScreen
      data={data}
      onSubmitGame={handleSubmitGame}
      onDeleteGame={handleDeleteGame}
    />
  );
};

export const Route = createFileRoute('/_owner/groups_/$groupId/matches/$matchId')({
  loader: async ({ params }) => {
    const data = await getMatchDetailServerFn({
      data: { groupId: params.groupId, matchId: params.matchId },
    });
    if (data === null) {
      throw redirect({
        to: '/groups/$groupId/matches',
        params: { groupId: params.groupId },
      });
    }
    return { data };
  },
  component: MatchDetailPage,
});
