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
 *   Claude Design handoff bundle, `Login.html` → `login.jsx` "Option B"
 *   (the only artboard the canvas renders, i.e. the confirmed design).
 *   It is a dark, hero-less mobile layout (375×812):
 *     - background #0E0E0E, foreground #FAFAF8, Geist + JetBrains Mono
 *     - left-aligned `JANROKU` mono wordmark (22px / 0.24em tracking)
 *     - tagline, then a white 52px Google button (rounded 6px, official
 *       4-colour G), an invitation-only dot-note, and a mono footer with
 *       利用規約 / プライバシー links + © 2026.
 *   The phone status bar and home indicator from the mockup are device
 *   chrome, not app UI, so they are intentionally dropped. The column is
 *   capped at `max-w-sm` and centred so the mobile proportions hold on
 *   wider viewports.
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

import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { signIn } from '../auth/client';
import { GoogleGlyph } from '../components/auth';
import { getSessionServerFn } from '../server/session';

const LoginPage = () => {
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
    <main className="flex min-h-screen justify-center bg-[#0E0E0E] font-sans text-[#FAFAF8]">
      {/* Mobile column (375pt). Capped at max-w-sm and centred so the phone
          proportions from the mockup hold on wider viewports. */}
      <div className="flex w-full max-w-sm flex-col">
        <section className="flex flex-1 flex-col justify-center px-8">
          {/* JANROKU mono wordmark — the brand mark and the page's single
              top-level heading. Left-aligned, JetBrains Mono, 0.24em track. */}
          <h1 className="font-mono text-[22px] font-medium tracking-[0.24em] text-[#FAFAF8]">
            JANROKU
          </h1>

          <p className="mt-4 max-w-[280px] text-sm leading-[1.6] text-[#999999]">
            身内・コミュニティ単位で開く
            <br />
            麻雀リーグの記録アプリ。
          </p>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isPending}
            data-testid="login-google-button"
            className="mt-10 inline-flex h-[52px] w-full items-center justify-center gap-3 rounded-md bg-[#FAFAF8] text-[15px] font-medium text-[#111111] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GoogleGlyph aria-hidden />
            <span>{isPending ? 'サインイン中…' : 'Google で続ける'}</span>
          </button>

          {error !== null ? (
            <p
              role="alert"
              data-testid="login-error"
              className="mt-3 rounded border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-200"
            >
              {error}
            </p>
          ) : null}

          {/* Invitation-only note — dot + text, no border (Option B). */}
          <div className="mt-5 flex items-start gap-2.5 px-1">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#FAFAF8]" />
            <p className="text-xs leading-[1.55] text-[#AAAAAA]">
              <span className="font-medium text-[#FAFAF8]">招待制です。</span>{' '}
              既存のオーナーから受け取った招待リンクからアカウントを作成してください。
            </p>
          </div>
        </section>

        {/* Footer — mono micro-type, legal links + copyright. The /terms and
            /privacy targets are intentional placeholders until those public
            pages land. */}
        <footer className="flex items-center justify-between px-6 pt-6 pb-7 font-mono text-[10px] tracking-[0.08em] text-[#888888]">
          <div className="flex gap-3.5">
            <a
              href="/terms"
              data-testid="login-terms-link"
              className="text-[#AAAAAA] no-underline hover:underline"
            >
              利用規約
            </a>
            <a
              href="/privacy"
              data-testid="login-privacy-link"
              className="text-[#AAAAAA] no-underline hover:underline"
            >
              プライバシー
            </a>
          </div>
          <span>© 2026</span>
        </footer>
      </div>
    </main>
  );
};

export const Route = createFileRoute('/login')({
  // Bounce already-authenticated owners straight to the home dashboard (S3).
  // This mirrors `_owner.tsx`'s gate, inverted: `_owner` redirects *un*authed
  // users to `/login`; here we redirect *authed* users away from `/login` so
  // landing on the sign-in page with a live session never strands them. It
  // also covers the post-OAuth return path — even if Better Auth ever lands
  // the callback back on `/login`, the live session forwards them to `/`.
  //
  // Failure mode: if the session probe itself throws (network / Worker
  // offline) we swallow it and render the login page — the user is here to
  // sign in anyway, so showing the form is the safe default.
  beforeLoad: async () => {
    let user: Awaited<ReturnType<typeof getSessionServerFn>> = null;
    try {
      user = await getSessionServerFn();
    } catch {
      // Probe failed (network / Worker offline). Stay on the login page —
      // the user is here to sign in anyway. Do not redirect.
      return;
    }

    if (user) {
      throw redirect({ to: '/' });
    }
  },
  component: LoginPage,
});
