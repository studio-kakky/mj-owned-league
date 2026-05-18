/**
 * TanStack Start server functions for S14 招待管理 (`04-screens.md` § S14,
 * Issue #21).
 *
 * Shape & boundaries — mirrors `server/groups.ts` (Issue #15):
 *   - Each handler is exported separately from its `createServerFn` wrapper
 *     so unit tests can exercise the logic without bundling the RPC compiler.
 *   - The route loader is the only place that crosses the RPC boundary; the
 *     screen (`InvitationsScreen`) is purely presentational.
 *   - Persistence sits behind the same in-memory store the other server
 *     modules use (`getGroupServerStore`). When TanStack Start gains D1
 *     access (#39), only the repository instantiation here changes — the
 *     projection and ownership filtering stay put.
 *
 * Owner-scoped reads / writes:
 *   Every handler takes `ownerId` and refuses to mutate / read invitations
 *   that don't belong to the caller. This is defence-in-depth alongside the
 *   eventual server-side session check.
 *
 * Why we re-host `InvitationService` here instead of importing the existing
 * instance:
 *   `InvitationService` is constructed with explicit deps (clock, id /
 *   token factories). It currently has no module-level singleton — each
 *   call site builds its own. The route layer is the right place to wire
 *   it because the deps (real `Date`, real `crypto.randomUUID`) only make
 *   sense outside the test boundary.
 */

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type { InvitationListItem, InvitationUiStatus } from '../components/invitations';
import type { Invitation, NewInvitation } from '../db/schema';
import type { InvitationRepository } from '../repositories/interfaces';
import { InvitationInvalidError } from '../services/errors';
import { InvitationService } from '../services/invitation-service';
import {
  type GroupServerStore,
  getGroupServerStore,
  type InMemoryStoreShape,
  seedDevDataIfEmpty,
} from './groups-store';

// ---------------------------------------------------------------------------
// Repository facade
// ---------------------------------------------------------------------------

interface ServerDeps {
  service: InvitationService;
  repo: InvitationRepository;
}

/**
 * Builds an `InvitationService` backed by the shared in-memory store.
 * Exported clock / id deps are not surfaced here because production callers
 * want the real ones; the test seam is at the handler / service-test level.
 */
const makeDeps = (): ServerDeps => {
  const store = getGroupServerStore();
  const repo = new MemoryInvitationRepository(store);
  const service = new InvitationService(repo);
  return { service, repo };
};

// ---------------------------------------------------------------------------
// Input schemas / types
// ---------------------------------------------------------------------------

const listInvitationsInput = z.object({ ownerId: z.string().min(1) });

const issueInvitationInput = z.object({
  ownerId: z.string().min(1),
  /**
   * Owner-supplied memo. Accepts an empty string (which we normalise to
   * `null`) so the client can pass the trimmed form value without an extra
   * branch.
   */
  memo: z.string().max(120).optional(),
});

const revokeInvitationInput = z.object({
  ownerId: z.string().min(1),
  invitationId: z.string().min(1),
});

export type ListInvitationsInput = z.infer<typeof listInvitationsInput>;
export type IssueInvitationServerInput = z.infer<typeof issueInvitationInput>;
export type RevokeInvitationServerInput = z.infer<typeof revokeInvitationInput>;

/**
 * Override hooks for tests. Production callers should not pass these — the
 * service constructor's defaults are correct in real use.
 */
export interface InvitationHandlerDeps {
  /** Wall-clock source for the UI-status projection (expiry check). */
  now?: () => Date;
}

// ---------------------------------------------------------------------------
// Projection helper
// ---------------------------------------------------------------------------

const deriveUiStatus = (row: Invitation, nowMs: number): InvitationUiStatus => {
  if (row.status === 'CONSUMED') return 'CONSUMED';
  if (row.status === 'REVOKED') return 'REVOKED';
  // status === 'PENDING' — distinguish expired vs still usable.
  const expiresAtMs = Date.parse(row.expiresAt);
  if (Number.isNaN(expiresAtMs) || expiresAtMs <= nowMs) return 'EXPIRED';
  return 'PENDING';
};

/**
 * Collapses the domain {@link Invitation} row into the screen's UI
 * projection.
 *
 * The UI status is derived as:
 *   - REVOKED  / CONSUMED  → pass through.
 *   - PENDING & expired    → EXPIRED.
 *   - PENDING & not expired→ PENDING.
 */
const projectToListItem = (row: Invitation, nowMs: number): InvitationListItem => {
  return {
    id: row.id,
    memo: row.memo,
    token: row.token,
    status: deriveUiStatus(row, nowMs),
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Returns the Owner's invitations sorted newest-first, with each row
 * projected into its UI shape. The projection collapses domain status +
 * `expiresAt` into a single {@link InvitationUiStatus} value so the screen
 * never has to recompute "is this still usable?".
 */
export const listInvitationsHandler = async (
  input: ListInvitationsInput,
  deps: InvitationHandlerDeps = {},
): Promise<ReadonlyArray<InvitationListItem>> => {
  // Materialise the dev seed on the first call per owner — same hook the
  // other server modules use. Idempotent thanks to `seededOwnerIds`.
  seedDevDataIfEmpty(input.ownerId);

  const { service } = makeDeps();
  const now = deps.now ?? (() => new Date());
  const nowMs = now().getTime();

  const rows = await service.listByIssuer(input.ownerId);

  // Most recent first. Repository doesn't expose ordering yet (see
  // InvitationService docstring); we sort in the projection layer instead.
  return rows
    .slice()
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : a.createdAt < b.createdAt ? 1 : 0))
    .map((row) => projectToListItem(row, nowMs));
};

/**
 * Issues a new invitation for the caller. Returns the freshly-created row
 * (UI projection) plus the raw token so the screen can build the share URL
 * without a round trip.
 */
export const issueInvitationHandler = async (
  input: IssueInvitationServerInput,
  deps: InvitationHandlerDeps = {},
): Promise<{ token: string; invitation: InvitationListItem }> => {
  // Don't seed on issue — listing seeds first, and seeding on a mutation
  // would conflate "user is new" with "user just issued a new invitation".
  // If the dashboard runs first the seed materialises before we get here;
  // if not, an empty initial list is the correct state.

  const { service, repo } = makeDeps();
  const now = deps.now ?? (() => new Date());

  const memo = input.memo === undefined || input.memo === '' ? null : input.memo;

  const issued = await service.issue({
    issuedByOwnerId: input.ownerId,
    memo,
  });

  // `issue` returns a narrow shape — fetch the full row so we can project
  // the same `InvitationListItem` the list returns. This keeps the screen's
  // contract uniform.
  const row = await repo.findById(issued.id);
  if (row === null) {
    // Practically impossible (we just created it); guard so a future
    // repository swap can't silently break.
    throw new Error(`Invitation ${issued.id} was created but could not be reloaded.`);
  }

  return {
    token: issued.token,
    invitation: projectToListItem(row, now().getTime()),
  };
};

/**
 * Revokes a PENDING invitation. Throws (so the modal can surface the
 * message) when the invitation does not exist, belongs to another Owner,
 * or is not in a revocable state.
 */
export const revokeInvitationHandler = async (
  input: RevokeInvitationServerInput,
  deps: InvitationHandlerDeps = {},
): Promise<{ revoked: true; invitation: InvitationListItem }> => {
  const { service, repo } = makeDeps();
  const now = deps.now ?? (() => new Date());

  // Ownership guard — fetch first so we can produce a deterministic error
  // when the id refers to someone else's invitation. We deliberately
  // collapse "not found" and "not yours" into the same `NOT_FOUND` shape
  // so a malicious client can't probe for ids.
  const existing = await repo.findById(input.invitationId);
  if (existing === null || existing.issuedByOwnerId !== input.ownerId) {
    throw new InvitationInvalidError('NOT_FOUND');
  }

  const revoked = await service.revoke(input.invitationId);
  return {
    revoked: true,
    invitation: projectToListItem(revoked, now().getTime()),
  };
};

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

export const listInvitationsServerFn = createServerFn({ method: 'GET' })
  .inputValidator(listInvitationsInput)
  .handler(({ data }) => listInvitationsHandler(data));

export const issueInvitationServerFn = createServerFn({ method: 'POST' })
  .inputValidator(issueInvitationInput)
  .handler(({ data }) => issueInvitationHandler(data));

export const revokeInvitationServerFn = createServerFn({ method: 'POST' })
  .inputValidator(revokeInvitationInput)
  .handler(({ data }) => revokeInvitationHandler(data));

// ---------------------------------------------------------------------------
// In-memory repository
// ---------------------------------------------------------------------------
// Same shape as the other server-module repos. When the D1 binding lands
// this gets swapped for a Drizzle-backed implementation and nothing above
// has to change.

class MemoryInvitationRepository implements InvitationRepository {
  constructor(private readonly store: GroupServerStore) {}

  async findById(id: string): Promise<Invitation | null> {
    return this.store.invitations.get(id) ?? null;
  }

  async findByToken(token: string): Promise<Invitation | null> {
    for (const row of this.store.invitations.values()) {
      if (row.token === token) return row;
    }
    return null;
  }

  async listByIssuer(ownerId: string): Promise<Invitation[]> {
    return [...this.store.invitations.values()].filter((i) => i.issuedByOwnerId === ownerId);
  }

  async create(input: InMemoryStoreShape['invitations']): Promise<Invitation> {
    const row: Invitation = {
      createdAt: new Date().toISOString(),
      status: 'PENDING',
      memo: null,
      consumedAt: null,
      consumedByUserId: null,
      revokedAt: null,
      ...input,
    } as Invitation;
    this.store.invitations.set(row.id, row);
    return row;
  }

  async update(id: string, input: Partial<Omit<NewInvitation, 'id'>>): Promise<Invitation | null> {
    const existing = this.store.invitations.get(id);
    if (!existing) return null;
    const next = { ...existing, ...input } as Invitation;
    this.store.invitations.set(id, next);
    return next;
  }
}
