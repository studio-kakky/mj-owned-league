/**
 * `/matches/$matchId` — S9 Match 詳細 + S11-S13 対局 CRUD
 * (`04-screens.md` § S9 / S11 / S12 / S13, Issue #19).
 *
 * Wiring strategy mirrors `/leagues/$leagueId` (Issue #18):
 *   - `getMatchDetailServerFn` → loader. Returns `null` for not-found /
 *     cross-Owner; we surface that as a redirect to the cross-Group list.
 *   - Game submit / delete are owned by callbacks on the screen. They go
 *     through `submitGameServerFn` / `deleteGameServerFn` and then
 *     `router.invalidate()` so the ranking / list re-renders without a
 *     manual refetch.
 *   - The presentational {@link MatchDetailScreen} hosts the S11 / S12 /
 *     S13 modals internally; this route file never sees the modal state.
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

export const Route = createFileRoute('/_owner/matches/$matchId')({
  loader: async ({ context, params }) => {
    const data = await getMatchDetailServerFn({
      data: { ownerId: context.ownerSession.ownerId, matchId: params.matchId },
    });
    if (data === null) {
      throw redirect({ to: '/matches' });
    }
    return { data };
  },
  component: MatchDetailPage,
});

function MatchDetailPage() {
  const router = useRouter();
  const { ownerSession } = Route.useRouteContext();
  const { data } = Route.useLoaderData();

  const handleSubmitGame = useCallback(
    async (input: GameSubmitInput) => {
      await submitGameServerFn({ data: bridgeGameSubmit(ownerSession.ownerId, input) });
      await router.invalidate();
    },
    [ownerSession.ownerId, router],
  );

  const handleDeleteGame = useCallback(
    async (gameId: string) => {
      await deleteGameServerFn({ data: { ownerId: ownerSession.ownerId, gameId } });
      await router.invalidate();
    },
    [ownerSession.ownerId, router],
  );

  return (
    <MatchDetailScreen
      data={data}
      onSubmitGame={handleSubmitGame}
      onDeleteGame={handleDeleteGame}
    />
  );
}
