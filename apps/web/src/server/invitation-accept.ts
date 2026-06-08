/**
 * TanStack Start server functions for S2 招待受け入れ (`04-screens.md` § S2,
 * Issue #13).
 *
 * Two handlers live here:
 *
 *   - {@link verifyInvitationHandler} — read-only token lookup used by the
 *     accept page's loader. Returns either a `valid` projection (issuer
 *     email / memo / expiresAt) so the screen can render "招待元情報", or an
 *     `invalid` projection carrying the {@link InvitationInvalidReason} so
 *     the screen can render the right error copy.
 *
 *   - {@link consumeInvitationHandler} — write path used by the post-OAuth
 *     callback route (`/invitations/accept/$token/complete`). Requires both
 *     a token and the authenticated `userId` of the freshly-signed-up user.
 *     Calls `InvitationService.consume`, which atomically re-verifies and
 *     marks the row CONSUMED.
 *
 * Why we *also* re-verify on consume (instead of trusting verify upstream):
 *   The verify call happens at page load, then the user goes through Google
 *   OAuth (typically tens of seconds). The token's status can change in that
 *   window — another Owner could revoke it, or the Owner could let it
 *   expire by waiting past `expiresAt`. `InvitationService.consume`
 *   re-evaluates the rules so the consume path stays safe even if verify is
 *   never called (or is called and ignored).
 *
 * Choice between "verify before OAuth" vs "consume after OAuth":
 *   We do **both**, with consume as the authoritative gate (per Issue #13's
 *   guidance: "実装しやすい方で OK"). Reasoning:
 *
 *     1. Verify on screen load gives the inviter information that the issue
 *        explicitly asks for ("招待元情報を表示"). Without verify the screen
 *        cannot render the issuer's email / memo.
 *     2. Consume after sign-up is the *only* defensible authoritative step —
 *        verify-only would leave a window where a revoked token still gets
 *        a usable Google session, which contradicts the acceptance criterion
 *        "有効なトークンのみアカウント作成可能".
 *
 *   The trade-off: a revoked token can still mint a Better Auth `user` /
 *   `owners` row via the `databaseHooks.user.create.after` hook *before*
 *   consume runs. That is documented in {@link consumeInvitationHandler}; a
 *   follow-up issue (#13's PR body lists it explicitly) tightens the seam by
 *   either pulling the consume check inside the hook chain or deleting the
 *   user when consume rejects.
 *
 * Owner-scoped writes:
 *   consume is *not* owner-scoped — the consumer is the new user being
 *   created, not an existing Owner. The path is gated by the raw token
 *   value, which is treated as secret-equivalent (`db/schema.ts` § Invitation).
 *
 * In-memory store reuse:
 *   Same repository facade as `server/invitations.ts` so the verify path
 *   sees rows the Owner just issued. When the D1 binding lands (#39), only
 *   the repository wiring in this file changes.
 */

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { findOwnerById } from '../auth/ensure-owner';
import { createDb } from '../db/client';
import type { Invitation, NewInvitation } from '../db/schema';
import type { InvitationRepository } from '../repositories/interfaces';
import { InvitationInvalidError, type InvitationInvalidReason } from '../services/errors';
import { InvitationService } from '../services/invitation-service';
import {
  type GroupServerStore,
  getGroupServerStore,
  type InMemoryStoreShape,
} from './groups-store';

// ---------------------------------------------------------------------------
// Public-facing projection types
// ---------------------------------------------------------------------------

/**
 * Discriminated union returned by {@link verifyInvitationHandler}. The route
 * loader hands this to the screen as-is so the rendering branch is a single
 * `switch`.
 */
export type VerifyInvitationResult =
  | {
      kind: 'valid';
      /** Owner-supplied memo at issue time. `null` when omitted. */
      memo: string | null;
      /** ISO timestamp. */
      expiresAt: string;
      /**
       * Issuer-facing email — for MVP we surface the Owner's email as the
       * "招待元情報". Domain doc does not yet model a display name on Owner;
       * the email is the only identifying string we have without crossing
       * into Better Auth's `user.name` (which would require the auth tables
       * here, and the issuer's user row is not necessarily the caller's).
       */
      issuerEmail: string;
    }
  | {
      kind: 'invalid';
      reason: InvitationInvalidReason;
    };

// ---------------------------------------------------------------------------
// Repository facade — same pattern as server/invitations.ts
// ---------------------------------------------------------------------------

interface ServerDeps {
  service: InvitationService;
  repo: InvitationRepository;
}

const makeDeps = (): ServerDeps => {
  const store = getGroupServerStore();
  const repo = new MemoryInvitationRepository(store);
  const service = new InvitationService(repo);
  return { service, repo };
};

// ---------------------------------------------------------------------------
// Input schemas / types
// ---------------------------------------------------------------------------

const verifyInvitationInput = z.object({ token: z.string().min(1) });
const consumeInvitationInput = z.object({
  token: z.string().min(1),
  /**
   * Authenticated user id from Better Auth's session. The caller (the
   * `/invitations/accept/$token/complete` route's `beforeLoad`) reads this
   * from `authClient.getSession()` after the OAuth roundtrip completes.
   */
  userId: z.string().min(1),
});

export type VerifyInvitationInput = z.infer<typeof verifyInvitationInput>;
export type ConsumeInvitationInput = z.infer<typeof consumeInvitationInput>;

/** Test hook for clock-dependent behaviour (expiry). */
export interface InvitationAcceptHandlerDeps {
  now?: () => Date;
  /**
   * Lookup hook for the issuer's email. Defaults to reading from the same
   * in-memory store; tests can swap in a fixed implementation. The seam is
   * here (not on `InvitationService`) because the service knows nothing
   * about Owners — surfacing "who issued this" is purely a server-function
   * concern.
   */
  resolveIssuerEmail?: (ownerId: string) => Promise<string | null>;
}

// ---------------------------------------------------------------------------
// Issuer email resolution
// ---------------------------------------------------------------------------

/**
 * Default issuer-email lookup. Reads from the in-memory store's `owners`
 * shape — except the store does not currently track owners as a Map (the
 * Owner row materialises in D1 via Better Auth's hook, not in this in-memory
 * fixture). For the in-memory dev path we fall back to the Owner id itself
 * as a stand-in: it is opaque, but it gives the screen *something* to render
 * during dev before D1 access lands (#39). Once #39 ships this function
 * grows a D1 read via {@link findOwnerById}.
 *
 * Tests should override this via `deps.resolveIssuerEmail` so the projection
 * is deterministic regardless of which seam ends up live.
 */
const defaultResolveIssuerEmail = async (ownerId: string): Promise<string | null> => {
  // Cheap path: if the seeded fixture happened to populate something we can
  // surface, prefer that. The dev seed in `groups-store.ts` does not
  // currently insert into `owners` — there is no `Map<string, Owner>` to
  // walk — so for now we just return the ownerId as a placeholder string.
  //
  // The reason we don't try `findOwnerById(createDb(env.DB), ownerId)` here
  // is that `env.DB` is not reachable from the TanStack Start server
  // function context (#39). Once it is, replace this body with:
  //
  //   const owner = await findOwnerById(createDb(env.DB), ownerId);
  //   return owner?.email ?? null;
  //
  // Static-reference both `createDb` and `findOwnerById` so the follow-up
  // call site lands without an unused-import churn.
  void createDb;
  void findOwnerById;
  return ownerId;
};

// ---------------------------------------------------------------------------
// Dev-only preview fixture
// ---------------------------------------------------------------------------

/**
 * Fixed token that materialises a PENDING invitation for design / QA preview.
 * Open `/invitations/accept/dev` in `vite dev` to see the valid (招待元情報 +
 * 「Google で承諾」) state without first logging in as an Owner and issuing a
 * real invite.
 */
const DEV_PREVIEW_TOKEN = 'dev';

/**
 * Materialise the single dev preview invitation if it is missing. This is the
 * one sanctioned exception to "verify never seeds" (see the handler docstring
 * below): it is gated on `import.meta.env.DEV` *and* on a hard-coded constant
 * token — never on caller input — so it cannot be abused to seed fixtures for
 * an attacker-controlled `ownerId`. It is a no-op (and unreachable) in
 * production builds.
 */
const ensureDevPreviewInvitation = (): void => {
  const store = getGroupServerStore();
  if (store.invitations.has('dev-preview-invitation')) return;
  store.invitations.set('dev-preview-invitation', {
    id: 'dev-preview-invitation',
    // `defaultResolveIssuerEmail` surfaces the ownerId as the issuer email,
    // so use an email-shaped value to make the preview look realistic.
    issuedByOwnerId: 'owner@example.com',
    memo: 'デザイン確認用のプレビュー招待',
    token: DEV_PREVIEW_TOKEN,
    status: 'PENDING',
    expiresAt: '2099-01-01T00:00:00.000Z',
    consumedByUserId: null,
    consumedAt: null,
    revokedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Reads an invitation by raw token. Returns a discriminated `valid` /
 * `invalid` shape so the screen can render without any further server
 * round-trips.
 *
 * Note: this handler intentionally does **not** seed the dev store off
 * caller input. The accept URL is public — seeding off a guessed token would
 * silently materialise fixtures for an attacker-controlled `ownerId`. The
 * flow is always: an Owner first lists/issues an invitation (which seeds),
 * then the invitee opens the URL. The sole exception is the dev-only,
 * fixed-token preview fixture (`ensureDevPreviewInvitation`).
 */
export const verifyInvitationHandler = async (
  input: VerifyInvitationInput,
  deps: InvitationAcceptHandlerDeps = {},
): Promise<VerifyInvitationResult> => {
  if (import.meta.env.DEV && input.token === DEV_PREVIEW_TOKEN) {
    ensureDevPreviewInvitation();
  }

  const { service } = makeDeps();
  const resolveIssuerEmail = deps.resolveIssuerEmail ?? defaultResolveIssuerEmail;

  // Inject `now` into the service per-call rather than re-instantiating it
  // with a custom dep — the service already owns the clock for expiry logic.
  // We do this by reaching into the service's constructor seam:
  const serviceWithClock =
    deps.now === undefined ? service : new InvitationService(makeDeps().repo, { now: deps.now });

  try {
    const invitation = await serviceWithClock.verify(input.token);
    const issuerEmail = (await resolveIssuerEmail(invitation.issuedByOwnerId)) ?? '';
    return {
      kind: 'valid',
      memo: invitation.memo,
      expiresAt: invitation.expiresAt,
      issuerEmail,
    };
  } catch (cause) {
    if (cause instanceof InvitationInvalidError) {
      return { kind: 'invalid', reason: cause.reason };
    }
    // Anything else is a bug; let it bubble so we get a 500 + stack trace.
    throw cause;
  }
};

/**
 * Marks the invitation CONSUMED on behalf of the supplied user. Throws
 * {@link InvitationInvalidError} when the token is no longer usable so the
 * caller can surface the reason to the user.
 *
 * Ordering note (Issue #13 acceptance criterion "サインアップとトークン消費
 * の順序"):
 *   This handler runs **after** Better Auth has created the `user` row
 *   (because we need a stable `userId` to record on `consumedByUserId`). The
 *   `databaseHooks.user.create.after` hook has therefore already materialised
 *   an `owners` row for the new user — that is fine for the happy path, and
 *   the unhappy-path mitigation lives in the docstring above (a future issue
 *   tightens it).
 */
export const consumeInvitationHandler = async (
  input: ConsumeInvitationInput,
  deps: InvitationAcceptHandlerDeps = {},
): Promise<{ consumed: true }> => {
  const { repo } = makeDeps();
  const service =
    deps.now === undefined
      ? new InvitationService(repo)
      : new InvitationService(repo, { now: deps.now });

  await service.consume(input.token, input.userId);
  return { consumed: true };
};

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

export const verifyInvitationServerFn = createServerFn({ method: 'GET' })
  .inputValidator(verifyInvitationInput)
  .handler(({ data }) => verifyInvitationHandler(data));

export const consumeInvitationServerFn = createServerFn({ method: 'POST' })
  .inputValidator(consumeInvitationInput)
  .handler(({ data }) => consumeInvitationHandler(data));

// ---------------------------------------------------------------------------
// In-memory repository — duplicates `server/invitations.ts` to keep this
// module self-contained. When D1 lands they collapse into one shared
// `repositories/drizzle.ts` implementation.
// ---------------------------------------------------------------------------

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
