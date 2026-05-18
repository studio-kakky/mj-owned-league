/**
 * `/settings` — S16 Settings (Ruleset / Player 管理) (`04-screens.md` § S16,
 * Issue #17).
 *
 * Wiring strategy mirrors `/groups` and `/`:
 *   - The loader is the only place that crosses the TanStack Start RPC
 *     boundary. It pulls the active-group-scoped Settings payload via
 *     `getSettingsServerFn`.
 *   - The screen component (`SettingsScreen`) takes the payload + action
 *     callbacks as props and emits no service calls of its own.
 *   - Every mutation calls `router.invalidate()` after success so the loader
 *     re-fetches and the lists reflect the new state. This is the same
 *     pattern used by `/groups`.
 *
 * Active group resolution:
 *   The server picks the Owner's first Group as the active context (see
 *   `server/settings.ts` for the rationale). When the GroupSwitcher (Issue
 *   #11) starts surfacing a selected group via the layout, we will plumb
 *   that id into the loader's input — the server function already accepts
 *   the substitution by virtue of validating both `groupId` arguments on
 *   mutations and re-deriving the active group on read.
 */

import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useCallback } from 'react';
import { z } from 'zod';
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

// Optional `?groupId=` lets callers (S6 Group 詳細 link) deep-link to "the
// Settings of that Group" without having to flip the global active-group
// picker. The server handler silently falls back to the Owner's first
// Group when the id is foreign / stale.
const searchSchema = z.object({
  groupId: z.string().min(1).optional(),
});

const SettingsPage = () => {
  const router = useRouter();
  const { ownerSession } = Route.useRouteContext();
  const { data } = Route.useLoaderData();

  // `groupId` is captured at the top so all action callbacks can close over
  // it. When the active group is `null` (Owner has no Groups yet) every
  // mutation is a no-op; the SettingsScreen disables every write affordance
  // in that branch but we guard here as a defence-in-depth.
  const groupId = data.group?.id ?? null;

  const handleCreateRuleset = useCallback(
    async (input: RulesetFormInput) => {
      if (groupId === null) return;
      await createRulesetServerFn({
        data: { ownerId: ownerSession.ownerId, groupId, input },
      });
      await router.invalidate();
    },
    [groupId, ownerSession.ownerId, router],
  );

  const handleUpdateRuleset = useCallback(
    async (rulesetId: string, input: RulesetFormInput) => {
      await updateRulesetServerFn({
        data: { ownerId: ownerSession.ownerId, rulesetId, input },
      });
      await router.invalidate();
    },
    [ownerSession.ownerId, router],
  );

  const handleDeleteRuleset = useCallback(
    async (rulesetId: string) => {
      await deleteRulesetServerFn({
        data: { ownerId: ownerSession.ownerId, rulesetId },
      });
      await router.invalidate();
    },
    [ownerSession.ownerId, router],
  );

  const handleSetDefaultRuleset = useCallback(
    async (rulesetId: string) => {
      await setDefaultRulesetServerFn({
        data: { ownerId: ownerSession.ownerId, rulesetId },
      });
      await router.invalidate();
    },
    [ownerSession.ownerId, router],
  );

  const handleCreatePlayer = useCallback(
    async (name: string) => {
      if (groupId === null) return;
      await createPlayerServerFn({
        data: { ownerId: ownerSession.ownerId, groupId, name },
      });
      await router.invalidate();
    },
    [groupId, ownerSession.ownerId, router],
  );

  const handleRenamePlayer = useCallback(
    async (playerId: string, name: string) => {
      await renamePlayerServerFn({
        data: { ownerId: ownerSession.ownerId, playerId, name },
      });
      await router.invalidate();
    },
    [ownerSession.ownerId, router],
  );

  const handleDeletePlayer = useCallback(
    async (playerId: string) => {
      await deletePlayerServerFn({
        data: { ownerId: ownerSession.ownerId, playerId },
      });
      await router.invalidate();
    },
    [ownerSession.ownerId, router],
  );

  const handleDeactivatePlayer = useCallback(
    async (playerId: string) => {
      await deactivatePlayerServerFn({
        data: { ownerId: ownerSession.ownerId, playerId },
      });
      await router.invalidate();
    },
    [ownerSession.ownerId, router],
  );

  const handleReactivatePlayer = useCallback(
    async (playerId: string) => {
      await reactivatePlayerServerFn({
        data: { ownerId: ownerSession.ownerId, playerId },
      });
      await router.invalidate();
    },
    [ownerSession.ownerId, router],
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

export const Route = createFileRoute('/_owner/settings')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ groupId: search.groupId }),
  loader: async ({ context, deps }) => {
    const data = await getSettingsServerFn({
      data: { ownerId: context.ownerSession.ownerId, groupId: deps.groupId },
    });
    return { data };
  },
  component: SettingsPage,
});
