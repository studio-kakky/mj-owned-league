/**
 * Delete-confirmation modal for the S4 Group 一覧 screen.
 *
 * The acceptance criterion on Issue #15 is "履歴依存で削除可否を判定".
 * Implementation strategy:
 *  - When the Group has NO Games / Players (`hasHistory === false`), the
 *    modal renders a primary "削除する" button that fires `onConfirm`.
 *  - When the Group HAS history (`hasHistory === true`), the same modal
 *    renders an explanation copy and disables the primary action. The
 *    rule mirrors `PlayerService.delete` from `02-domain-model.md` § Player:
 *    we refuse physical deletion that would silently rewrite history.
 *
 * We surface the rule inside the modal (rather than just hiding the
 * "削除" button on the list card) so the Owner has a clear explanation of
 * why deletion is blocked — without that, the missing button reads as a
 * bug. The Owner can still rename the Group from S5; archival workflows
 * are out of scope for the MVP.
 */

import { useId, useState } from 'react';
import { Modal } from './Modal';

export interface GroupDeleteConfirmModalProps {
  open: boolean;
  /** Group name shown in the dialog body. */
  groupName: string;
  /**
   * Whether the Group has at least one Game attached. Pre-computed by the
   * route loader (`GroupService.hasHistory`) so this component can render
   * its copy synchronously without spinning up async work.
   */
  hasHistory: boolean;
  onClose: () => void;
  /**
   * Called when the Owner confirms a no-history deletion. May return a
   * Promise; the modal disables the button while the promise is pending
   * and keeps the modal open if it rejects.
   */
  onConfirm: () => void | Promise<void>;
}

export function GroupDeleteConfirmModal({
  open,
  groupName,
  hasHistory,
  onClose,
  onConfirm,
}: GroupDeleteConfirmModalProps) {
  const titleId = useId();
  const [isDeleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (hasHistory) {
      // Guard at the UI level too: even if some caller passes
      // `hasHistory={true}` and an `onConfirm`, we refuse to fire it.
      return;
    }
    setError(null);
    setDeleting(true);
    try {
      await onConfirm();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'グループの削除に失敗しました。');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} testId="group-delete-modal">
      <div className="space-y-5">
        <div className="space-y-2">
          <h2 id={titleId} className="text-base font-semibold text-zinc-100">
            グループを削除
          </h2>
          <p className="text-sm text-zinc-300">
            <span className="font-medium text-zinc-100">{groupName}</span>{' '}
            を削除しようとしています。
          </p>
        </div>

        {hasHistory ? (
          <p
            data-testid="group-delete-history-notice"
            className="rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-100"
          >
            このグループには対局履歴があるため、物理削除できません。
            <br />
            運用方針が決まるまで現状維持としてください。グループ名の変更は可能です。
          </p>
        ) : (
          <p className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300">
            このグループには対局履歴がありません。削除すると配下のプレイヤーやデフォルトのルールセットも一緒に削除されます。
          </p>
        )}

        {error !== null ? (
          <p
            role="alert"
            data-testid="group-delete-error"
            className="rounded-lg border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-200"
          >
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-full px-4 py-2 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting || hasHistory}
            data-testid="group-delete-confirm"
            className="rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? '削除中…' : '削除する'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
