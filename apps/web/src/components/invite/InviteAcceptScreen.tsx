/**
 * S2 招待受け入れ — presentational screen
 * (`docs/docs/04-screens.md` § S2, `docs/docs/03-user-flow.md` § F1, Issue #13).
 *
 * 表示分岐:
 *   - `valid`   → 招待元情報 + 「Google で承諾」ボタン
 *   - `invalid` → エラーカード (理由別の文言)
 *
 * 設計方針:
 *   - presentational. 認証や consume の呼び出しは親ルートに委譲する
 *     (S1 ログインと同じ構造)。
 *   - `signIn.social` は親が呼ぶ責務にしている: S1 と機能としては似ているが、
 *     callbackURL の組み立て / token の sessionStorage 退避が必要なので、
 *     その判断を screen 内に閉じ込めるのは無理筋。
 *   - モバイル 375pt 基準。`max-w-sm` を保ち、ログイン画面と並びを揃える。
 *
 * デザイン source:
 *   `api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=Invite.html`
 *   は 404 (バンドル期限切れ) のため、視覚スタイルは S1 ログイン
 *   (`routes/login.tsx`) と PublicShell の既存トークンに揃える: zinc-950
 *   背景、emerald アクセント、rounded-full ピル型ボタン、JANROKU ワードマーク。
 */

import { useState } from 'react';
import type { InvitationInvalidReason } from '../../services';

/**
 * 親ルート (`/invitations/accept/$token`) が `verifyInvitationHandler` の戻り
 * 値をそのまま流し込む。screen は kind で分岐するだけ。
 */
export type InviteAcceptVerifyResult =
  | {
      kind: 'valid';
      memo: string | null;
      expiresAt: string;
      issuerEmail: string;
    }
  | {
      kind: 'invalid';
      reason: InvitationInvalidReason;
    };

export interface InviteAcceptScreenProps {
  verification: InviteAcceptVerifyResult;
  /**
   * 「Google で承諾」ボタン押下時の callback。親側で
   *   1. `sessionStorage` などに token を退避
   *   2. `signIn.social({ provider: 'google', callbackURL: '/invitations/accept/<token>/complete' })`
   * を行う。Promise を返してよく、resolve するまでボタンは disable される。
   */
  onAccept: () => void | Promise<void>;
}

export function InviteAcceptScreen({ verification, onAccept }: InviteAcceptScreenProps) {
  return (
    <main
      className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100"
      data-testid="invite-accept-screen"
    >
      <header className="px-6 pt-10">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-100">JANROKU</p>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm space-y-8">
          {verification.kind === 'valid' ? (
            <ValidBody
              memo={verification.memo}
              expiresAt={verification.expiresAt}
              issuerEmail={verification.issuerEmail}
              onAccept={onAccept}
            />
          ) : (
            <InvalidBody reason={verification.reason} />
          )}
        </div>
      </section>

      <footer className="border-t border-zinc-900 bg-zinc-950">
        <div className="mx-auto flex max-w-sm flex-col items-center gap-2 px-6 py-6 text-xs text-zinc-500">
          <p>JANROKU は招待制の麻雀リーグ記録サービスです。</p>
        </div>
      </footer>
    </main>
  );
}

// ---------------------------------------------------------------------------
// 有効な招待 — 招待元情報 + 「Google で承諾」
// ---------------------------------------------------------------------------

interface ValidBodyProps {
  memo: string | null;
  expiresAt: string;
  issuerEmail: string;
  onAccept: () => void | Promise<void>;
}

function ValidBody({ memo, expiresAt, issuerEmail, onAccept }: ValidBodyProps) {
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setError(null);
    setPending(true);
    try {
      await onAccept();
      // 親が signIn.social → Google にリダイレクトする想定。返ってきたら
      // disable のまま (連打防止) — リダイレクト失敗時のみ手動で reset する。
    } catch (cause) {
      setPending(false);
      setError(
        cause instanceof Error
          ? cause.message
          : '招待の受け入れを開始できませんでした。時間をおいて再度お試しください。',
      );
    }
  };

  return (
    <>
      <div className="space-y-3 text-center">
        <h1 className="text-2xl font-bold text-zinc-50">招待を受け入れる</h1>
        <p className="text-sm text-zinc-400">
          JANROKU への招待を受け取りました。
          <br />
          下のボタンから Google アカウントでサインアップしてください。
        </p>
      </div>

      <div
        data-testid="invite-accept-issuer-card"
        className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
      >
        <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">招待元</p>
        <p
          data-testid="invite-accept-issuer-email"
          className="break-all text-sm font-semibold text-zinc-100"
        >
          {issuerEmail || '(発行者情報なし)'}
        </p>
        {memo !== null && memo !== '' ? (
          <p data-testid="invite-accept-memo" className="text-xs text-zinc-400">
            メモ: {memo}
          </p>
        ) : null}
        <p data-testid="invite-accept-expires" className="text-xs text-zinc-500">
          有効期限 {formatDate(expiresAt)}
        </p>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={handleClick}
          disabled={isPending}
          data-testid="invite-accept-google-button"
          className="flex w-full items-center justify-center gap-3 rounded-full border border-zinc-700 bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <GoogleGlyph aria-hidden />
          <span>{isPending ? '承諾処理中…' : 'Google で承諾'}</span>
        </button>

        {error !== null ? (
          <p
            role="alert"
            data-testid="invite-accept-error"
            className="rounded-lg border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-200"
          >
            {error}
          </p>
        ) : null}
      </div>

      <p className="text-center text-xs leading-relaxed text-zinc-500">
        承諾すると Google アカウントで JANROKU の Owner として登録されます。
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------
// 無効な招待 — 理由別エラー
// ---------------------------------------------------------------------------

const INVALID_TITLE: Record<InvitationInvalidReason, string> = {
  NOT_FOUND: '招待が見つかりません',
  EXPIRED: '招待の有効期限が切れています',
  CONSUMED: 'この招待は既に使用されています',
  REVOKED: 'この招待は取り消されています',
};

const INVALID_DESCRIPTION: Record<InvitationInvalidReason, string> = {
  NOT_FOUND:
    'URL を確認してください。リンクが古い場合は、発行者に新しい招待 URL を依頼してください。',
  EXPIRED: '発行者に新しい招待 URL を依頼してください。招待は発行から 7 日間有効です。',
  CONSUMED:
    'この招待 URL は既に他の方が使用しました。心当たりがない場合は発行者に確認してください。',
  REVOKED:
    '招待の発行者がこの URL を取り消しました。新しい招待が必要な場合は発行者に依頼してください。',
};

function InvalidBody({ reason }: { reason: InvitationInvalidReason }) {
  return (
    <>
      <div className="space-y-3 text-center">
        <h1 className="text-2xl font-bold text-zinc-50">招待を受け入れられません</h1>
      </div>

      <div
        data-testid={`invite-accept-invalid-${reason}`}
        role="alert"
        className="space-y-2 rounded-xl border border-rose-900/60 bg-rose-950/30 p-4"
      >
        <p className="text-sm font-semibold text-rose-200">{INVALID_TITLE[reason]}</p>
        <p className="text-xs text-rose-300/80">{INVALID_DESCRIPTION[reason]}</p>
      </div>

      <p className="text-center text-xs leading-relaxed text-zinc-500">
        既に Owner アカウントをお持ちの場合は{' '}
        <a
          href="/login"
          className="text-zinc-300 underline-offset-2 hover:underline"
          data-testid="invite-accept-login-link"
        >
          サインイン
        </a>{' '}
        してください。
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * `YYYY/MM/DD` 整形。InvitationsScreen と同じロジックだが、まだ依存する 2 画
 * 面しか無いので共通化はしない (3 枚目で出たら util に分離する)。
 */
function formatDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}

/**
 * Google "G" マーク (login.tsx と同じ SVG)。
 * - 共通化していない理由: 共有先が 2 箇所だけだとモジュール越境よりも
 *   ファイル内 self-contained のほうが読みやすい。3 箇所目で共通化する。
 */
function GoogleGlyph(props: { 'aria-hidden'?: boolean }) {
  return (
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
