/**
 * S14 招待発行モーダル — フォーム単体。送付先メモ (任意) を入力して発行ボタン
 * を押すと、親から渡された `onSubmit` を await し、解決後に親側でリンク表示
 * モーダル (`InvitationCreatedModal`) に切り替える。
 *
 * メモは "for Bob" のような Owner 向けの覚書で、`InvitationService.issue` の
 * `memo` パラメータにそのまま渡す。空文字は親で `null` に正規化される想定だ
 * が、このモーダル自身でも trim 後の空文字を `''` のまま送り、親 (`/invitations`
 * ルート) が `memo: input.memo || null` で扱う方式にすると分岐が一箇所で済む。
 *
 * 形式上は GroupFormModal とほぼ同じ構造だが、別コンポーネントとして切り出
 * している:
 *   - フィールドが optional であって required ではない (バリデーションの分岐
 *     が真逆)
 *   - サブミット後の遷移先が「リンク表示モーダル」というドメイン固有のフロー
 */

import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { Modal } from '../groups/Modal';

export interface InvitationFormModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * メモ (空文字許容) を渡して呼ばれる。Promise を返してよい — モーダルは
   * 解決まで送信ボタンを disable し、reject 時はモーダルを開いたままエラー
   * を表示する。
   */
  onSubmit: (memo: string) => void | Promise<void>;
}

export const InvitationFormModal = ({ open, onClose, onSubmit }: InvitationFormModalProps) => {
  const titleId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [memo, setMemo] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-open 時にステートを初期化する。GroupFormModal と同じパターンで、前回
  // 残ったメモが意図せず再表示されないようにする。
  useEffect(() => {
    if (open) {
      setMemo('');
      setError(null);
      setSubmitting(false);
      Promise.resolve().then(() => inputRef.current?.focus());
    }
  }, [open]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // メモは任意。trim はするが、長さ 0 は許容して `''` のまま親に渡す。
    const trimmed = memo.trim();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : '招待の発行に失敗しました。時間をおいて再度お試しください。',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} testId="invitation-create-modal">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1">
          <h2 id={titleId} className="text-base font-semibold text-zinc-100">
            招待を発行
          </h2>
          <p className="text-xs text-zinc-500">
            招待 URL を生成します。URL はメール / チャットなどで手動で共有してください。
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor={inputId} className="block text-xs font-medium text-zinc-300">
            送付先メモ <span className="text-zinc-500">(任意)</span>
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            value={memo}
            maxLength={120}
            onChange={(event) => setMemo(event.target.value)}
            data-testid="invitation-form-memo-input"
            className="block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
            placeholder="例: 友人の田中さん"
          />
          <p className="text-[11px] text-zinc-500">
            自分のための覚書です。招待される側には表示されません。
          </p>
        </div>

        {error !== null ? (
          <p
            role="alert"
            data-testid="invitation-form-error"
            className="rounded-lg border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-200"
          >
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-full px-4 py-2 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            data-testid="invitation-form-submit"
            className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? '発行中…' : '発行'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
