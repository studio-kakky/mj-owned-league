/**
 * Delete-confirmation modal for a single Ruleset on the S16 Settings screen.
 *
 * Two refusal cases handled in copy:
 *   - `isDefault` — the row is currently the Group's default Ruleset. We
 *     refuse because the schema's `Group.defaultRulesetId` would become a
 *     dangling reference (the DB-side `ON DELETE SET NULL` would clear it
 *     silently, which is the wrong UX). The Owner is asked to pick another
 *     default first.
 *   - In-use by Games — not enforced here at MVP. `games.rulesetId` has
 *     `onDelete: 'restrict'`, so a delete attempt would fail at the DB
 *     layer; the server function surfaces that as a generic error message.
 *     Wiring a cheap pre-check is tracked alongside #39 D1 work.
 */

import { useId, useState } from 'react';
import { Modal } from './Modal';

export interface RulesetDeleteConfirmModalProps {
  open: boolean;
  rulesetName: string;
  isDefault: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

export const RulesetDeleteConfirmModal = ({
  open,
  rulesetName,
  isDefault,
  onClose,
  onConfirm,
}: RulesetDeleteConfirmModalProps) => {
  const titleId = useId();
  const [isDeleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (isDefault) return;
    setError(null);
    setDeleting(true);
    try {
      await onConfirm();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ルールセットの削除に失敗しました。');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} testId="ruleset-delete-modal">
      <div className="space-y-5">
        <div className="space-y-2">
          <h2 id={titleId} className="text-base font-semibold text-zinc-100">
            ルールセットを削除
          </h2>
          <p className="text-sm text-zinc-300">
            <span className="font-medium text-zinc-100">{rulesetName}</span>{' '}
            を削除しようとしています。
          </p>
        </div>

        {isDefault ? (
          <p
            data-testid="ruleset-delete-default-notice"
            className="rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-100"
          >
            このルールセットはグループの既定として設定されています。先に別のルールセットを既定に切り替えてから削除してください。
          </p>
        ) : (
          <p className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300">
            既に作成済みの対局には影響しません（各対局には作成時のルールがコピーされます）。新しい対局でのみ選択できなくなります。
          </p>
        )}

        {error !== null ? (
          <p
            role="alert"
            data-testid="ruleset-delete-error"
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
            disabled={isDeleting || isDefault}
            data-testid="ruleset-delete-confirm"
            className="rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? '削除中…' : '削除する'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
