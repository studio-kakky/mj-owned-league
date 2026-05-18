import { useState } from 'react';
import { GoogleGlyph } from './GoogleGlyph';

interface ValidBodyProps {
  memo: string | null;
  expiresAt: string;
  issuerEmail: string;
  onAccept: () => void | Promise<void>;
}

/**
 * `YYYY/MM/DD` 整形。InvitationsScreen と同じロジックだが、まだ依存する 2 画
 * 面しか無いので共通化はしない (3 枚目で出たら util に分離する)。
 */
const formatDate = (iso: string): string => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
};

export const ValidBody = ({ memo, expiresAt, issuerEmail, onAccept }: ValidBodyProps) => {
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
};
