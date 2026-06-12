/**
 * `/matches/new` — legacy redirect (Issue #61).
 *
 * The Match 作成 form moved to `/groups/:groupId/matches/new` so it shares the
 * Group namespace with its list (S9). The old flat URL only carried context via
 * `?leagueId=` / `?groupId=`. We resolve the destination Group as follows:
 *   - `?groupId=` when supplied (the canonical Group for the form);
 *   - otherwise the active Group from the `_owner` layout context;
 *   - `/groups` (selection screen) when neither is available.
 * A surviving `?leagueId=` is forwarded so a League-pinned deep link keeps its
 * pin; the destination loader re-validates it against the resolved Group.
 */

import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';

const searchSchema = z.object({
  leagueId: z.string().min(1).optional(),
  groupId: z.string().min(1).optional(),
});

export const Route = createFileRoute('/_owner/matches/new')({
  validateSearch: searchSchema,
  beforeLoad: ({ context, search }) => {
    const targetGroupId = search.groupId ?? context.activeGroup?.id ?? null;
    if (targetGroupId === null) {
      throw redirect({ to: '/groups' });
    }
    throw redirect({
      to: '/groups/$groupId/matches/new',
      params: { groupId: targetGroupId },
      search: search.leagueId !== undefined ? { leagueId: search.leagueId } : {},
    });
  },
});
