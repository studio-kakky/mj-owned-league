/**
 * TanStack Start server functions for the Owner's *active group* selection
 * (Issue #58).
 *
 * The active group is the Group the Owner is currently "in" — the one whose
 * S6 ホーム the post-login redirect and the header group-switcher land on. It
 * is persisted on the Owner row (`owners.activeGroupId`) rather than in a
 * cookie / client store so the choice survives logout, new devices, and SSR.
 *
 * Two operations:
 *
 *   - `getActiveGroupServerFn` → reads `owners.activeGroupId`. Used by the
 *     `_owner` layout's `beforeLoad` to decide which Group the header shows as
 *     active. Returns the raw id (or `null`); the layout reconciles it against
 *     the live group list (a dangling id — e.g. a Group that was deleted out
 *     from under a stale session — is treated as "no selection").
 *
 *   - `setActiveGroupServerFn` → writes `owners.activeGroupId`. Called when the
 *     Owner picks a Group on `/groups` or via the switcher sheet. Validates
 *     that the target Group is owned by the caller before saving, so a forged
 *     RPC cannot point an Owner at someone else's Group.
 *
 * Boundaries mirror the other `src/server/*.ts` modules:
 *   - The handlers are exported separately from the `createServerFn` wrappers
 *     so unit tests can drive them without the RPC compiler.
 *   - `ownerId` is resolved server-side from the Better Auth session
 *     (`requireOwnerId()`), never accepted from the client. The handlers still
 *     take it explicitly so tests can pass it directly.
 *   - Pass a `Database` for the D1-backed production path; pass nothing for the
 *     in-memory store the tests drive.
 */

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type { Database } from '../db/client';
import { DrizzleGroupRepository, DrizzleOwnerRepository } from '../repositories/drizzle';
import type { GroupRepository } from '../repositories/interfaces';
import { OwnerService } from '../services/owner-service';
import { getRequestDb, requireOwnerId } from './context';
import { getGroupServerStore, seedDevDataIfEmpty } from './groups-store';
import { MemoryGroupRepository, MemoryOwnerRepository } from './memory-repos';

interface ServerRepos {
  owners: OwnerService;
  groups: GroupRepository;
}

const makeRepos = (db?: Database): ServerRepos => {
  if (db) {
    return {
      owners: new OwnerService(new DrizzleOwnerRepository(db)),
      groups: new DrizzleGroupRepository(db),
    };
  }
  const store = getGroupServerStore();
  return {
    owners: new OwnerService(new MemoryOwnerRepository(store)),
    groups: new MemoryGroupRepository(store),
  };
};

// Client-facing validator. `ownerId` is intentionally absent — it is resolved
// server-side from the session. The `*Input` type adds it for the handler.
const setActiveGroupInput = z.object({
  groupId: z.string().min(1),
});

export type GetActiveGroupInput = { ownerId: string };
export type SetActiveGroupInput = z.infer<typeof setActiveGroupInput> & { ownerId: string };

/**
 * Returns the Owner's persisted `activeGroupId`, or `null` when none is set /
 * the Owner row does not exist yet. The caller reconciles the id against the
 * live group list — this handler does not validate that the referenced Group
 * still exists or is still owned, because the list-reconciliation in the
 * layout already covers the "dangling id" case and keeps this read cheap.
 */
export const getActiveGroupHandler = async (
  input: GetActiveGroupInput,
  db?: Database,
): Promise<string | null> => {
  // Memory mode only: materialise the dev fixtures (incl. the Owner row) on
  // first access so there is something to read. With D1 the Owner row is
  // created by the Better Auth bootstrap, so we never seed.
  if (!db) seedDevDataIfEmpty(input.ownerId);

  const { owners } = makeRepos(db);
  const owner = await owners.findById(input.ownerId);
  return owner?.activeGroupId ?? null;
};

/**
 * Persists `groupId` as the Owner's active group after verifying ownership.
 *
 * Returns `{ ok: true, groupId }` on success and `{ ok: false }` when the
 * target Group does not exist or belongs to a different Owner — the caller
 * treats `ok: false` as "refresh and retry" rather than navigating. Ownership
 * is re-checked here (not trusted from the client) so a forged RPC cannot set
 * an Owner's active group to a Group they do not own.
 */
export const setActiveGroupHandler = async (
  input: SetActiveGroupInput,
  db?: Database,
): Promise<{ ok: true; groupId: string } | { ok: false }> => {
  if (!db) seedDevDataIfEmpty(input.ownerId);

  const { owners, groups } = makeRepos(db);

  // Ownership guard: the Group must exist and belong to the caller.
  const group = await groups.findById(input.groupId);
  if (group === null || group.ownerId !== input.ownerId) {
    return { ok: false };
  }

  const updated = await owners.update(input.ownerId, { activeGroupId: input.groupId });
  if (updated === null) {
    // No Owner row to update — should never happen behind the `_owner` gate
    // (the row is materialised by the auth bootstrap), but we surface it as a
    // recoverable failure rather than a thrown error.
    return { ok: false };
  }
  return { ok: true, groupId: input.groupId };
};

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

export const getActiveGroupServerFn = createServerFn({ method: 'GET' }).handler(async () =>
  getActiveGroupHandler({ ownerId: await requireOwnerId() }, getRequestDb()),
);

export const setActiveGroupServerFn = createServerFn({ method: 'POST' })
  .inputValidator(setActiveGroupInput)
  .handler(async ({ data }) =>
    setActiveGroupHandler({ ...data, ownerId: await requireOwnerId() }, getRequestDb()),
  );
