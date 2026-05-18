/**
 * `/invitations/accept/$token/complete` — post-OAuth consume step
 * (`docs/docs/04-screens.md` § S2, `docs/docs/03-user-flow.md` § F1 step 3,
 * Issue #13).
 *
 * Purpose:
 *   This is the URL Better Auth lands on *after* it has set the session
 *   cookie for a freshly-authenticated Google user. Its only job is to:
 *
 *     1. Read the active session (`authClient.getSession()`).
 *     2. Mark the invitation CONSUMED via {@link consumeInvitationServerFn}.
 *     3. Redirect to `/groups?onboarding=1` so the user lands on the Group
 *        creation surface (S4 / S5) with onboarding affordances enabled.
 *
 * The page never renders meaningful content for the happy path — it does
 * its work in `beforeLoad` and redirects. We keep a tiny `component`
 * because TanStack Router requires one; it briefly flashes a "招待を確定
 * 中…" placeholder if the redirect is slow.
 *
 * Error handling (Issue #13 acceptance criterion "期限切れ / 使用済み /
 * 不正トークンはエラー表示"):
 *   If the token is no longer usable (e.g. expired between verify and
 *   consume, or revoked after the OAuth roundtrip), we redirect back to
 *   `/invitations/accept/$token` with `?error=<reason>` so the loader
 *   surfaces the appropriate error card. The verify call there will return
 *   `invalid` for any of the same conditions, so the user sees the right
 *   copy without us having to render a third surface.
 *
 *   If the session probe itself fails (no Better Auth session — unusual,
 *   would indicate Google OAuth never completed), redirect to `/login`. The
 *   token-bearing accept URL is still in their browser history if they
 *   want to retry.
 *
 * Ordering note (Issue #13 acceptance criterion "サインアップ後 / 前のいずれ
 * かで token 消費"):
 *   We chose the **after** variant — verify on screen load, consume after
 *   OAuth. See {@link consumeInvitationHandler}'s docstring for the
 *   rationale. The acceptance-criterion mitigation
 *   ("無効になっていたらユーザーを未承認状態として扱う") is implemented as
 *   "redirect back to the accept page with the failure reason" — the
 *   Better Auth user / `owners` row that already got materialised by the
 *   `databaseHooks.user.create.after` hook stays put for now; tightening
 *   that seam is tracked separately in the PR body.
 */

import { createFileRoute, redirect } from '@tanstack/react-router';
import { authClient } from '../auth/client';
import { consumeInvitationServerFn } from '../server/invitation-accept';
import type { InvitationInvalidReason } from '../services';
import { INVITATION_INVALID_REASONS, InvitationInvalidError } from '../services';

/**
 * Server functions serialise thrown errors as plain JSON, so by the time the
 * exception reaches us the `instanceof InvitationInvalidError` check fails.
 * We pattern-match on the documented shape (an object carrying a `reason`
 * string that belongs to {@link INVITATION_INVALID_REASONS}) and surface
 * `null` for anything we don't recognise so the caller rethrows it.
 */
const extractInvitationInvalidReason = (cause: unknown): InvitationInvalidReason | null => {
  if (typeof cause !== 'object' || cause === null) return null;
  const reason = (cause as { reason?: unknown }).reason;
  if (typeof reason !== 'string') return null;
  return INVITATION_INVALID_REASONS.includes(reason as InvitationInvalidReason)
    ? (reason as InvitationInvalidReason)
    : null;
};

/**
 * Placeholder body. `beforeLoad` always throws a redirect on the happy and
 * sad paths, so this only renders during the brief moment before the
 * redirect resolves.
 */
const InviteAcceptCompletePage = () => {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100">
      <div className="space-y-2 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-100">JANROKU</p>
        <p className="text-xs text-zinc-500">招待を確定中…</p>
      </div>
    </main>
  );
};

export const Route = createFileRoute('/invitations/accept/$token/complete')({
  beforeLoad: async ({ params }) => {
    // 1. Confirm Better Auth has a session. Without one, the user never
    //    completed Google OAuth — send them back to `/login` so they can
    //    retry (or to the accept page if they have the token URL handy).
    let session: Awaited<ReturnType<typeof authClient.getSession>> | null = null;
    try {
      session = await authClient.getSession();
    } catch {
      throw redirect({ to: '/login' });
    }
    if (!session?.data?.user) {
      throw redirect({ to: '/login' });
    }
    const userId = session.data.user.id;

    // 2. Consume the token. The service re-verifies and atomically marks
    //    the row CONSUMED.
    try {
      await consumeInvitationServerFn({
        data: { token: params.token, userId },
      });
    } catch (cause) {
      // Translate domain failures into a redirect back to the accept page
      // carrying the reason. The accept loader will surface the matching
      // error card on the next render via its own verify call. The `?error`
      // query param is informational (visible in the URL bar for support /
      // debugging) — the verify result is the authoritative source.
      //
      // We use `href:` rather than `{ to, params, search }` because adding
      // a `validateSearch` schema to the accept route only to thread one
      // optional debug param through would expand the public surface for
      // no behavioural gain.
      if (cause instanceof InvitationInvalidError) {
        throw redirect({
          href: `/invitations/accept/${params.token}?error=${cause.reason}`,
        });
      }

      // Server functions transport errors as plain JSON; the prototype
      // chain doesn't survive. Fall back to a string-level match on the
      // `reason` field so we still route to the right error card.
      const reason = extractInvitationInvalidReason(cause);
      if (reason !== null) {
        throw redirect({
          href: `/invitations/accept/${params.token}?error=${reason}`,
        });
      }

      throw cause;
    }

    // 3. Happy path — land on Group creation with onboarding context.
    //    The query flag tells the destination route to surface the create
    //    modal on first paint. `/groups?onboarding=1` is the URL agreed in
    //    the Issue body. We use `href:` rather than `{ to, search }` so we
    //    don't have to widen `/_owner/groups`'s `validateSearch` schema
    //    just for this redirect — `/groups` will pick the parameter up via
    //    `useSearch` (or simply ignore it for now; the onboarding modal
    //    wiring is a follow-up).
    throw redirect({ href: '/groups?onboarding=1' });
  },
  component: InviteAcceptCompletePage,
});
