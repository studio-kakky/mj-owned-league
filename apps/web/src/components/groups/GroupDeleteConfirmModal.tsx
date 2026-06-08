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

export const GroupDeleteConfirmModal = ({
  open,
  groupName,
  hasHistory,
  onClose,
  onConfirm,
}: GroupDeleteConfirmModalProps) => {
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
      <div className="flex flex-col">
        <div className="flex shrink-0 items-center gap-3 border-b border-[#1F1F1F] px-4 py-3.5">
          <h2 id={titleId} className="flex-1 text-[15px] font-semibold text-[#FAFAF8]">
            グループを削除
          </h2>
          <button
            type="button"
            aria-label="閉じる"
            onClick={onClose}
            disabled={isDeleting}
            className="-mr-1 inline-flex items-center justify-center p-1 text-[#FAFAF8] disabled:opacity-60"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <title>閉じる</title>
              <path
                d="M5 5 L15 15 M15 5 L5 15"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="px-5 py-6">
          <span className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#c87878]/[0.12] text-[#c87878]">
            <svg width="24" height="24" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <title>削除</title>
              <path
                d="M3 4.5 H13 M5.5 4.5 V3 H10.5 V4.5 M5 4.5 L5.5 13 H10.5 L11 4.5 M7 7 V11 M9 7 V11"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p className="text-lg font-semibold text-[#FAFAF8]">
            <span className="break-all">{groupName}</span> を削除しますか？
          </p>

          {hasHistory ? (
            <p
              data-testid="group-delete-history-notice"
              className="mt-4 rounded-lg border border-amber-900/60 bg-amber-950/40 px-4 py-3 text-xs leading-relaxed text-amber-100"
            >
              このグループには対局履歴があるため、物理削除できません。
              <br />
              運用方針が決まるまで現状維持としてください。グループ名の変更は可能です。
            </p>
          ) : (
            <p className="mt-3 text-[13px] leading-relaxed text-[#888888]">
              配下のプレイヤー・リーグ・デフォルトのルールセットも一緒に削除されます。
              <br />
              この操作は元に戻せません。
            </p>
          )}

          {error !== null ? (
            <p
              role="alert"
              data-testid="group-delete-error"
              className="mt-3 rounded border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-200"
            >
              {error}
            </p>
          ) : null}
        </div>

        <div className="mb-4 flex shrink-0 justify-center gap-2 px-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="h-[34px] rounded-full border border-[#262626] px-3.5 text-[13px] font-medium text-[#FAFAF8] transition-colors hover:border-[#3a3a3a] disabled:cursor-not-allowed disabled:opacity-60"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting || hasHistory}
            data-testid="group-delete-confirm"
            className="h-[34px] rounded-full bg-[#c87878] px-[18px] text-[13px] font-semibold text-[#0E0E0E] transition-colors hover:bg-[#d88c8c] disabled:cursor-not-allowed disabled:bg-[#2a2a2a] disabled:text-[#666666]"
          >
            {isDeleting ? '削除中…' : '削除'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
