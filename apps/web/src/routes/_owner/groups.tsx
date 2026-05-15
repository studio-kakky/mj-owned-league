/**
 * `/groups` — S4 Group 一覧 + S5 Group 作成 (`04-screens.md` § S4 / S5).
 *
 * Wiring strategy (and the reason this file is short):
 *
 *   The screen itself (`GroupsScreen`) is purely presentational — it takes
 *   a `GroupListItem[]` plus three callbacks and emits no I/O. The "real"
 *   data path is server-function-backed and ends in Drizzle/D1, but the
 *   server-function plumbing is still TODO (see the comment at the top of
 *   `apps/web/worker/index.ts`: the full TanStack Start ↔ Workers
 *   integration "with the D1 binding plumbed through to server functions
 *   [is] tracked as a follow-up issue"). Until that exists we cannot
 *   meaningfully `await groupService.listByOwner(...)` from a route loader.
 *
 *   So this route uses a `useState`-backed in-memory store for the
 *   lifetime of the tab. The store is intentionally bound to the browser
 *   session (not to the worker / D1) so the developer can verify the
 *   create / edit / delete flow end-to-end at `pnpm --filter web dev`
 *   without standing up the (yet-to-land) server function. When the
 *   server-function ticket merges, only this file needs to change —
 *   `GroupsScreen` and the service layer already match the production
 *   shape.
 *
 *   The store seeds with two example Groups (one with a fabricated
 *   `hasHistory: true` so the delete-modal "履歴があるため削除不可" copy
 *   is reachable during manual QA). The seed is local development scaffolding
 *   only; production data comes from D1 via the loader.
 */

import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import type { GroupListItem } from '../../components/groups';
import { GroupsScreen } from '../../components/groups';

export const Route = createFileRoute('/_owner/groups')({
  component: GroupsPage,
});

/**
 * Seed data used only during development until the route loader wires up
 * the real D1-backed query. Kept inside the route module (not exported) so
 * no other code accidentally depends on it.
 */
const DEV_SEED: ReadonlyArray<GroupListItem> = [
  {
    id: 'dev-group-1',
    name: '金曜定例会',
    playerCount: 6,
    leagueCount: 1,
    lastPlayedAt: '2026-05-08T00:00:00.000Z',
    // `true` so the delete-modal "履歴があるため削除不可" branch is
    // discoverable during manual QA.
    hasHistory: true,
  },
  {
    id: 'dev-group-2',
    name: '会社の同期会',
    playerCount: 4,
    leagueCount: 0,
    lastPlayedAt: null,
    hasHistory: false,
  },
];

function GroupsPage() {
  const [groups, setGroups] = useState<ReadonlyArray<GroupListItem>>(DEV_SEED);

  const handleCreate = useCallback(async (name: string) => {
    setGroups((prev) => [
      ...prev,
      {
        // `crypto.randomUUID()` is available in modern browsers + Workers;
        // we cast through `string` because the type returned is a literal
        // template type that's noisy in our `GroupListItem.id: string`.
        id: globalThis.crypto.randomUUID(),
        name,
        playerCount: 0,
        leagueCount: 0,
        lastPlayedAt: null,
        // Brand-new Group has no history yet.
        hasHistory: false,
      },
    ]);
  }, []);

  const handleRename = useCallback(async (groupId: string, name: string) => {
    setGroups((prev) => prev.map((group) => (group.id === groupId ? { ...group, name } : group)));
  }, []);

  const handleDelete = useCallback(async (groupId: string) => {
    setGroups((prev) => prev.filter((group) => group.id !== groupId));
  }, []);

  return (
    <GroupsScreen
      groups={groups}
      onCreateGroup={handleCreate}
      onRenameGroup={handleRename}
      onDeleteGroup={handleDelete}
    />
  );
}
