/**
 * `/groups/$groupId/settings` — S16 グループ配下の Settings
 * (Ruleset / Player 管理) (`04-screens.md` § S16, Issue #62).
 *
 * Routing note (Issue #58 / #60 / #61 / #62):
 *   The file is named `groups_.$groupId.settings` (trailing underscore on the
 *   `groups` segment) so it does NOT nest under the `/groups` list route — the
 *   same pattern as `groups_.$groupId.leagues` (S15) and
 *   `groups_.$groupId.matches` (S9). `groups.tsx` renders the selection list
 *   directly without an `<Outlet />`, so a nested child would never mount.
 *   This is a standalone page under the `_owner` shell.
 *
 * Group scoping (Issue #62):
 *   The `groupId` comes solely from the URL path — there is no `?groupId=`
 *   query and no cross-Group fallback (the old `/settings` route had both).
 *   The server function narrows every projection to that Group and rejects
 *   (`null`) a foreign / unknown id; we surface that as a redirect to
 *   `/groups` (the selection screen is the natural recovery for a stale link).
 *
 * Wiring strategy mirrors the old `/settings` route it replaces:
 *   - This route file is the only place that crosses the TanStack Start RPC
 *     boundary. The presentational {@link SettingsScreen} takes the
 *     pre-projected payload as a prop and never imports the server functions.
 *   - `getSettingsServerFn` → route loader.
 *   - Every mutation calls `router.invalidate()` after success so the loader
 *     re-fetches and the lists reflect the new state.
 */

import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { useCallback } from 'react';
import type { RulesetFormInput } from '../../components/settings';
import { SettingsScreen } from '../../components/settings';
import {
  createPlayerServerFn,
  createRulesetServerFn,
  deactivatePlayerServerFn,
  deletePlayerServerFn,
  deleteRulesetServerFn,
  getSettingsServerFn,
  reactivatePlayerServerFn,
  renamePlayerServerFn,
  setDefaultRulesetServerFn,
  updateRulesetServerFn,
} from '../../server/settings';

const SettingsPage = () => {
  const router = useRouter();
  const { groupId } = Route.useParams();
  const { data } = Route.useLoaderData();

  const handleCreateRuleset = useCallback(
    async (input: RulesetFormInput) => {
      await createRulesetServerFn({ data: { groupId, input } });
      await router.invalidate();
    },
    [groupId, router],
  );

  const handleUpdateRuleset = useCallback(
    async (rulesetId: string, input: RulesetFormInput) => {
      await updateRulesetServerFn({ data: { rulesetId, input } });
      await router.invalidate();
    },
    [router],
  );

  const handleDeleteRuleset = useCallback(
    async (rulesetId: string) => {
      await deleteRulesetServerFn({ data: { rulesetId } });
      await router.invalidate();
    },
    [router],
  );

  const handleSetDefaultRuleset = useCallback(
    async (rulesetId: string) => {
      await setDefaultRulesetServerFn({ data: { rulesetId } });
      await router.invalidate();
    },
    [router],
  );

  const handleCreatePlayer = useCallback(
    async (name: string) => {
      await createPlayerServerFn({ data: { groupId, name } });
      await router.invalidate();
    },
    [groupId, router],
  );

  const handleRenamePlayer = useCallback(
    async (playerId: string, name: string) => {
      await renamePlayerServerFn({ data: { playerId, name } });
      await router.invalidate();
    },
    [router],
  );

  const handleDeletePlayer = useCallback(
    async (playerId: string) => {
      await deletePlayerServerFn({ data: { playerId } });
      await router.invalidate();
    },
    [router],
  );

  const handleDeactivatePlayer = useCallback(
    async (playerId: string) => {
      await deactivatePlayerServerFn({ data: { playerId } });
      await router.invalidate();
    },
    [router],
  );

  const handleReactivatePlayer = useCallback(
    async (playerId: string) => {
      await reactivatePlayerServerFn({ data: { playerId } });
      await router.invalidate();
    },
    [router],
  );

  return (
    <SettingsScreen
      data={data}
      onCreateRuleset={handleCreateRuleset}
      onUpdateRuleset={handleUpdateRuleset}
      onDeleteRuleset={handleDeleteRuleset}
      onSetDefaultRuleset={handleSetDefaultRuleset}
      onCreatePlayer={handleCreatePlayer}
      onRenamePlayer={handleRenamePlayer}
      onDeletePlayer={handleDeletePlayer}
      onDeactivatePlayer={handleDeactivatePlayer}
      onReactivatePlayer={handleReactivatePlayer}
    />
  );
};

export const Route = createFileRoute('/_owner/groups_/$groupId/settings')({
  loader: async ({ params }) => {
    const data = await getSettingsServerFn({ data: { groupId: params.groupId } });
    if (data === null) {
      // Stale / cross-owner groupId. Send the user back to the selection
      // screen rather than rendering Settings for a Group that is not theirs.
      throw redirect({ to: '/groups' });
    }
    return { data };
  },
  component: SettingsPage,
});
