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

/**
 * アバター用イニシャル。ドメインに Owner 表示名が無く `issuerEmail` しか手元に
 * 無いため (`server/invitation-accept.ts` § issuer email resolution)、デザイン
 * の "TK" 相当はメールのローカル部から導出する。英数字以外は落とし、先頭 2 文字
 * を大文字化。空なら "?" を返す。
 */
const initialsFromEmail = (email: string): string => {
  const local = email.split('@')[0] ?? '';
  const cleaned = local.replace(/[^a-zA-Z0-9]/g, '');
  return cleaned.length === 0 ? '?' : cleaned.slice(0, 2).toUpperCase();
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

  const hasEmail = issuerEmail !== '';

  return (
    <>
      <p className="mt-7 text-[22px] font-medium leading-[1.35] tracking-[-0.01em] text-[#FAFAF8]">
        招待を受け取りました。
      </p>

      {/* 招待元カード。デザインは 氏名 + メール + アバター だが、バックエンドは
          email のみ保持するため identity 行に email を出す。 */}
      <div
        data-testid="invite-accept-issuer-card"
        className="mt-6 flex items-center gap-3.5 rounded-md border border-[#1F1F1F] p-4"
      >
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#1F1F1F] bg-[#1A1A1A] font-mono text-[13px] tracking-[0.04em] text-[#FAFAF8]">
          {initialsFromEmail(issuerEmail)}
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#888888]">FROM</p>
          <p
            data-testid="invite-accept-issuer-email"
            className="mt-0.5 break-all text-sm font-medium text-[#FAFAF8]"
          >
            {hasEmail ? issuerEmail : '(発行者情報なし)'}
          </p>
          {memo !== null && memo !== '' ? (
            <p
              data-testid="invite-accept-memo"
              className="mt-0.5 break-all font-mono text-[11px] tracking-[0.02em] text-[#999999]"
            >
              メモ: {memo}
            </p>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        data-testid="invite-accept-google-button"
        className="mt-8 inline-flex h-[52px] w-full items-center justify-center gap-3 rounded-md bg-[#FAFAF8] text-[15px] font-medium text-[#111111] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleGlyph aria-hidden />
        <span>{isPending ? '承諾処理中…' : 'Google で承諾して開始'}</span>
      </button>

      {error !== null ? (
        <p
          role="alert"
          data-testid="invite-accept-error"
          className="mt-3 rounded border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-200"
        >
          {error}
        </p>
      ) : null}

      {/* 注記 — ドット + テキスト。デザインの「7 日で失効」プレースホルダは実際の
          有効期限に置き換える (より正確で、従来表示とも一致)。 */}
      <div className="mt-5 flex flex-col gap-2.5 px-1">
        <div className="flex items-start gap-2.5">
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#666666]" />
          <p className="text-xs leading-[1.55] text-[#888888]">
            この招待は <span className="text-[#AAAAAA]">1 回のみ有効</span>。{' '}
            <span data-testid="invite-accept-expires">有効期限 {formatDate(expiresAt)}</span>。
          </p>
        </div>
        <div className="flex items-start gap-2.5">
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#666666]" />
          <p className="text-xs leading-[1.55] text-[#888888]">
            承諾すると Google アカウントで JANROKU の Owner として登録されます。
          </p>
        </div>
      </div>
    </>
  );
};
