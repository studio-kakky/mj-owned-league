/**
 * Confirmation modal for deleting a Game from S9 / S12
 * (`03-user-flow.md` § F7, Issue #19).
 *
 * Deletion is *physical* per the spec ("F7. 削除は物理削除"), and the parent
 * Match's 順位表 / 集計は再計算される。元に戻せない操作なので、誤タップ防止に
 * 確認モーダルを挟む。Group / Ruleset 削除モーダルと同じ形状で実装している。
 */

import { useId, useState } from 'react';
import { Modal } from '../../groups/Modal';
import type { MatchGameRow } from '../detail-types';

export interface GameDeleteConfirmModalProps {
  open: boolean;
  game: MatchGameRow | null;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

export const GameDeleteConfirmModal = ({
  open,
  game,
  onClose,
  onConfirm,
}: GameDeleteConfirmModalProps) => {
  const titleId = useId();
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : '削除に失敗しました。時間をおいて再度お試しください。',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} testId="game-delete-modal">
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 id={titleId} className="text-base font-semibold text-zinc-100">
            この対局を削除しますか？
          </h2>
          <p className="text-xs text-zinc-500">
            削除は物理削除です。順位表 / 集計が再計算されます。元に戻せません。
          </p>
        </div>
        {game !== null ? (
          <ul
            data-testid="game-delete-modal-summary"
            className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-200"
          >
            {game.results.map((r) => (
              <li key={r.playerId} className="flex justify-between gap-3 py-1">
                <span>
                  {r.rank}位 {r.playerName}
                </span>
                <span className="font-mono text-zinc-400">{r.rawScore.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {error !== null ? (
          <p
            role="alert"
            data-testid="game-delete-modal-error"
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
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            data-testid="game-delete-modal-confirm"
            className="rounded-full bg-rose-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition-colors hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? '削除中…' : '削除する'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
