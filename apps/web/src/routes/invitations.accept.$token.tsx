/**
 * `/invitations/accept/$token` — S2 招待受け入れ
 * (`docs/docs/04-screens.md` § S2, `docs/docs/03-user-flow.md` § F1, Issue #13).
 *
 * Route placement (top-level, not under `/_owner` or `/_public`):
 *   The accept page is reachable without authentication (the whole point of
 *   the invitation gate). Wrapping it in `/_owner` would force the auth
 *   redirect to `/login` before the user could ever sign up; wrapping it in
 *   `/_public` would render the public viewer header ("公開ビュー" badge)
 *   which is misleading on a sign-up surface. The screen catalog
 *   (`04-screens.md` § "URL 名前空間の整理") explicitly lists
 *   `/invitations/accept/:token` as its own top-level path — that mirrors
 *   the file layout here, matching `routes/login.tsx`.
 *
 * Flow (`docs/docs/03-user-flow.md` § F1):
 *   1. Loader calls {@link verifyInvitationServerFn} → `valid` | `invalid`.
 *   2. On `valid`, the screen renders 招待元情報 + 「Google で承諾」ボタン.
 *   3. Clicking the button:
 *        a. stores the raw token in `sessionStorage` so the *completion*
 *           route can pick it up after the OAuth roundtrip,
 *        b. calls `signIn.social({ provider: 'google', callbackURL: '/invitations/accept/<token>/complete' })`.
 *   4. Google redirects back to `/api/auth/callback/google`; Better Auth
 *      sets the session cookie and forwards to `callbackURL`.
 *   5. `/invitations/accept/<token>/complete` reads the session, calls
 *      {@link consumeInvitationServerFn}, and lands the user on
 *      `/groups?onboarding=1` (S4 + onboarding-aware variant).
 *
 * Why `sessionStorage` *and* `callbackURL` carry the token:
 *   - `callbackURL` is the canonical anchor — Better Auth round-trips it
 *     through the OAuth state, so it survives the Google detour.
 *   - `sessionStorage` is the belt-and-braces fallback: if a future change
 *     ever drops the token from the URL (e.g. swapping the callback to a
 *     fixed path), the completion route can still read it. The cost is
 *     a single `sessionStorage.setItem` per click.
 *
 * Token shape:
 *   The token is currently `crypto.randomUUID()` (see
 *   `services/invitation-service.ts`). UUIDs are URL-safe so we pass them
 *   raw — no encoding needed. The route param is therefore the plaintext
 *   token; the loader fetches the row by token via the service layer.
 */

import { createFileRoute } from '@tanstack/react-router';
import { signIn } from '../auth/client';
import { InviteAcceptScreen } from '../components/invite';
import { verifyInvitationServerFn } from '../server/invitation-accept';

/**
 * `sessionStorage` key for the in-flight token. Exported so the completion
 * route can read it without re-deriving the literal.
 */
export const INVITE_TOKEN_STORAGE_KEY = 'janroku.invitation.pendingToken';

const InviteAcceptPage = () => {
  const { token } = Route.useParams();
  const { verification } = Route.useLoaderData();

  const handleAccept = async () => {
    // Persist the token so the completion route can re-resolve it even if
    // the callback URL gets mangled (e.g. by a provider that strips path
    // segments). `sessionStorage` is per-tab, which matches the OAuth
    // round-trip's tab affinity.
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem(INVITE_TOKEN_STORAGE_KEY, token);
      } catch {
        // Storage may be unavailable (Safari private mode etc.). The
        // `callbackURL` still carries the token in the path, so we don't
        // surface this failure to the user.
      }
    }

    await signIn.social({
      provider: 'google',
      callbackURL: `/invitations/accept/${token}/complete`,
    });
  };

  return <InviteAcceptScreen verification={verification} onAccept={handleAccept} />;
};

export const Route = createFileRoute('/invitations/accept/$token')({
  loader: async ({ params }) => {
    const verification = await verifyInvitationServerFn({ data: { token: params.token } });
    return { verification };
  },
  component: InviteAcceptPage,
});
