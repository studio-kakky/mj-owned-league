/**
 * S14 招待取消確認モーダル。
 *
 * `InvitationService.revoke` は CONSUMED / REVOKED / EXPIRED を弾くため、こ
 * のモーダルは UI 上 "PENDING" の招待でのみ開かれる前提。誤って他状態の招待
 * に対して開かれても `disabled` 状態にして取り消しボタンを押せないように
 * しておく。
 *
 * 表示はメモがあればメモを、無ければ「(メモなし)」を表示する。Owner は通常
 * メモ越しに区別する想定。
 */

import { useId, useState } from 'react';
import { Modal } from '../../groups/Modal';

export interface InvitationRevokeConfirmModalProps {
  open: boolean;
  /** 表示用のメモ。`null` の場合は「(メモなし)」と表示する。 */
  memo: string | null;
  onClose: () => void;
  /**
   * 取り消し処理。Promise を返してよい。Reject 時はエラーをモーダル内に表示
   * してモーダルを開いたままにする。
   */
  onConfirm: () => void | Promise<void>;
}

export const InvitationRevokeConfirmModal = ({
  open,
  memo,
  onClose,
  onConfirm,
}: InvitationRevokeConfirmModalProps) => {
  const titleId = useId();
  const [isRevoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    setRevoking(true);
    try {
      await onConfirm();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '招待の取消に失敗しました。');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} testId="invitation-revoke-modal">
      <div className="space-y-5">
        <div className="space-y-2">
          <h2 id={titleId} className="text-base font-semibold text-zinc-100">
            招待を取り消す
          </h2>
          <p className="text-sm text-zinc-300">
            <span className="font-medium text-zinc-100">{memo ?? '(メモなし)'}</span>{' '}
            の招待を取り消します。
          </p>
          <p className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300">
            取り消すと、この招待 URL
            からはアカウントを作成できなくなります。再度招待が必要な場合は新しく発行してください。
          </p>
        </div>

        {error !== null ? (
          <p
            role="alert"
            data-testid="invitation-revoke-error"
            className="rounded-lg border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-200"
          >
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isRevoking}
            className="rounded-full px-4 py-2 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isRevoking}
            data-testid="invitation-revoke-confirm"
            className="rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRevoking ? '取消中…' : '取り消す'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
