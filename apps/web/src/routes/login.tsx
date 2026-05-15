/**
 * S1 ログイン (`docs/docs/04-screens.md` § S1, `docs/docs/03-user-flow.md` § F1).
 *
 * Invitation-only Owner sign-in. The only authentication path is Google
 * OAuth — Better Auth's server side (Issue #7) registers Google as the
 * sole social provider and rejects email/password sign-up outright.
 *
 * Why this route is at the top level (not under `/_owner` or `/_public`):
 *   - `/_owner` would wrap the page in `OwnerShell` (sticky header with a
 *     group switcher + 4-tab bottom nav). The login page has no group, no
 *     tabs, and no Owner identity to display yet — wrapping it makes the
 *     chrome lie about state.
 *   - `/_public` is for viewer pages (`/l/:slug`, `/m/:slug`). It renders a
 *     "公開ビュー" badge in the header which is misleading on an
 *     authentication surface.
 *   - The screen catalog (`04-screens.md` § "URL 名前空間の整理") lists
 *     `/login` as its own top-level path — that mirrors the file layout.
 *
 * Design source:
 *   The Claude Code design URL
 *   `api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=Login.html`
 *   returns HTTP 405 (the bundle has expired). Visual style is therefore
 *   anchored to the existing shells (PR #36): zinc-950 background,
 *   uppercase tracked JANROKU wordmark, rounded full-pill buttons,
 *   `max-w-3xl` page container scaled down to a centered card column for
 *   the auth surface. Mobile 375pt is the design baseline (Tailwind's
 *   mobile-first defaults).
 *
 * Sign-in flow:
 *   1. User taps "Google で続ける" → `signIn.social({ provider: 'google',
 *      callbackURL: '/' })`.
 *   2. Better Auth redirects the browser to Google's consent screen.
 *   3. Google redirects back to `/api/auth/callback/google`; Better Auth
 *      sets the session cookie and forwards to `callbackURL`.
 *   4. `/` (the Owner dashboard) renders with an authenticated session.
 *
 * Error handling is intentionally minimal: if `signIn.social` itself
 * throws (network failure before the redirect happens) we surface a
 * single-line error. Provider-side errors (Google cancel, consent
 * declined) are handled by Better Auth's callback handler — we will wire
 * a richer `?error=...` decoder in a follow-up issue once we have real
 * Google credentials and can reproduce the failure modes.
 */

import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { signIn } from '../auth/client';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage() {
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setPending(true);
    try {
      // `callbackURL` is what Better Auth navigates to *after* it sets the
      // session cookie. `/` is the Owner dashboard (S3).
      await signIn.social({ provider: 'google', callbackURL: '/' });
      // If `signIn.social` returns without redirecting (it shouldn't in a
      // browser context, but be defensive) leave `isPending = true` —
      // resetting it would briefly re-enable the button.
    } catch (cause) {
      setPending(false);
      setError(
        cause instanceof Error
          ? cause.message
          : 'サインインを開始できませんでした。時間をおいて再度お試しください。',
      );
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Top-left wordmark only — no nav. We deliberately do NOT link the
          wordmark anywhere (there is no signed-out landing page to send the
          user to). */}
      <header className="px-6 pt-10">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-100">JANROKU</p>
      </header>

      {/* Center column. `max-w-sm` keeps the card honest at 375pt mobile
          width and stays comfortable up to ~tablet. */}
      <section className="flex flex-1 flex-col items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-3 text-center">
            <h1 className="text-2xl font-bold text-zinc-50">サインイン</h1>
            <p className="text-sm text-zinc-400">
              JANROKU は招待制です。
              <br />
              既にお持ちのアカウントでサインインしてください。
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isPending}
              data-testid="login-google-button"
              className="flex w-full items-center justify-center gap-3 rounded-full border border-zinc-700 bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <GoogleGlyph aria-hidden />
              <span>{isPending ? 'サインイン中…' : 'Google で続ける'}</span>
            </button>

            {error !== null ? (
              <p
                role="alert"
                data-testid="login-error"
                className="rounded-lg border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-200"
              >
                {error}
              </p>
            ) : null}
          </div>

          <p className="text-center text-xs leading-relaxed text-zinc-500">
            新規登録は招待リンクからのみ可能です。招待がない場合は既存 Owner
            にお問い合わせください。
          </p>
        </div>
      </section>

      {/* Footer with legal links. The targets are intentional placeholders:
          MVP scope does not include public Terms / Privacy pages, but the
          links are required by the acceptance criteria so reviewers can
          confirm the slot exists. Replace with real URLs when those pages
          land. */}
      <footer className="border-t border-zinc-900 bg-zinc-950">
        <div className="mx-auto flex max-w-sm flex-col items-center gap-2 px-6 py-6 text-xs text-zinc-500">
          <p>
            続行することで、
            <a
              href="/terms"
              className="text-zinc-300 underline-offset-2 hover:underline"
              data-testid="login-terms-link"
            >
              利用規約
            </a>
            と
            <a
              href="/privacy"
              className="text-zinc-300 underline-offset-2 hover:underline"
              data-testid="login-privacy-link"
            >
              プライバシーポリシー
            </a>
            に同意したものとみなされます。
          </p>
        </div>
      </footer>
    </main>
  );
}

/**
 * Inline SVG of the Google "G" mark, traced from the public brand
 * guidelines. Keeping it inline (instead of an `<img>`) avoids a network
 * request and means the button still renders correctly inside the dark
 * theme even before Tailwind's preflight loads.
 */
function GoogleGlyph(props: { 'aria-hidden'?: boolean }) {
  return (
    // `<title>` is required by Biome's `noSvgWithoutTitle` lint rule
    // even when the icon is decorative (the surrounding button already
    // carries the accessible label "Google で続ける"). Keeping it
    // present satisfies the lint and gives screen readers that ignore
    // `aria-hidden` a sensible fallback.
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={props['aria-hidden']}
    >
      <title>Google</title>
      <path
        d="M17.64 9.2045c0-.638-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7955 2.7164v2.2587h2.9087c1.7018-1.5668 2.6832-3.8745 2.6832-6.6156z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2587c-.806.54-1.8368.8595-3.0477.8595-2.344 0-4.3282-1.5832-5.036-3.7104H.9573v2.3318C2.4382 15.9831 5.4818 18 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9c0 1.4523.3477 2.8268.9573 4.0418L3.964 10.71z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"
        fill="#EA4335"
      />
    </svg>
  );
}
