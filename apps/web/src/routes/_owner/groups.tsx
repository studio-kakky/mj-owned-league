/**
 * `/groups` — S4 Group 一覧 + S5 Group 作成 (`04-screens.md` § S4 / S5).
 *
 * Wiring strategy:
 *
 *   This file is the loader / action boundary for the screen. All data
 *   reads and writes go through TanStack Start server functions declared in
 *   `src/server/groups.ts`:
 *
 *     - `listGroupsServerFn`  → route `loader`. The `GroupsScreen` reads the
 *                               result via `Route.useLoaderData()`.
 *     - `createGroupServerFn` → invoked from the create modal.
 *     - `renameGroupServerFn` → invoked from the edit modal.
 *     - `deleteGroupServerFn` → invoked from the delete-confirm modal.
 *
 *   After every mutation we call `router.invalidate()` so the loader re-fetches
 *   and the list reflects the new state. The screen component itself
 *   (`GroupsScreen`) remains presentational — it never imports the server
 *   functions; this route is the only place that crosses the RPC boundary.
 *
 *   The previous iteration of this file held the data in `useState` with a
 *   hard-coded dev seed. That has been replaced: even though the server
 *   functions are currently backed by an in-process Map (see
 *   `src/server/groups.ts` for why the D1-backed swap is still pending),
 *   *the data lives on the server side of the RPC*. The client cannot
 *   bypass the server functions to mutate it.
 *
 *   Owner identity (`ownerId`) comes from the parent `_owner` layout's
 *   `beforeLoad`, which we surface via `Route.useRouteContext()` for client
 *   mutations and via `loaderDeps` for the loader.
 */

import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useCallback } from 'react';
import { GroupsScreen } from '../../components/groups';
import {
  createGroupServerFn,
  deleteGroupServerFn,
  listGroupsServerFn,
  renameGroupServerFn,
} from '../../server/groups';

export const Route = createFileRoute('/_owner/groups')({
  // The active owner id comes from the `_owner` parent layout's
  // `beforeLoad`, which is exposed on `context.ownerSession`. TanStack Router
  // re-runs the loader when the route is invalidated (after mutations
  // below), which is exactly the cadence we want.
  loader: async ({ context }) => {
    const items = await listGroupsServerFn({
      data: { ownerId: context.ownerSession.ownerId },
    });
    return { items };
  },
  component: GroupsPage,
});

function GroupsPage() {
  const router = useRouter();
  const { ownerSession } = Route.useRouteContext();
  const { items } = Route.useLoaderData();

  const handleCreate = useCallback(
    async (name: string) => {
      await createGroupServerFn({ data: { ownerId: ownerSession.ownerId, name } });
      await router.invalidate();
    },
    [ownerSession.ownerId, router],
  );

  const handleRename = useCallback(
    async (groupId: string, name: string) => {
      await renameGroupServerFn({
        data: { ownerId: ownerSession.ownerId, groupId, name },
      });
      await router.invalidate();
    },
    [ownerSession.ownerId, router],
  );

  const handleDelete = useCallback(
    async (groupId: string) => {
      await deleteGroupServerFn({
        data: { ownerId: ownerSession.ownerId, groupId },
      });
      await router.invalidate();
    },
    [ownerSession.ownerId, router],
  );

  return (
    <GroupsScreen
      groups={items}
      onCreateGroup={handleCreate}
      onRenameGroup={handleRename}
      onDeleteGroup={handleDelete}
    />
  );
}
