/**
 * Delete-confirmation modal for a single Player on the S16 Settings screen.
 *
 * Acceptance criterion on Issue #17: 「履歴ありの Player は削除不可 →
 * 非アクティブ化提案」.
 *
 * Implementation:
 *   - `hasHistory === false` — primary action is "削除する", calls
 *     `onConfirmDelete`. Service-layer `PlayerService.delete` is what
 *     actually fires.
 *   - `hasHistory === true`  — destructive button is disabled and a
 *     secondary "非アクティブにする" action is exposed instead, calling
 *     `onConfirmDeactivate`. That maps to `PlayerService.deactivate`.
 *
 * The split between `onConfirmDelete` / `onConfirmDeactivate` is intentional:
 * the route hands the right server function for each, so this component
 * never branches on which mutation to dispatch.
 */

import { useId, useState } from 'react';
import { Modal } from './Modal';

export interface PlayerDeleteConfirmModalProps {
  open: boolean;
  playerName: string;
  hasHistory: boolean;
  /** Currently `isActive` value, used to hide the deactivate CTA when already inactive. */
  isActive: boolean;
  onClose: () => void;
  onConfirmDelete: () => void | Promise<void>;
  onConfirmDeactivate: () => void | Promise<void>;
}

export const PlayerDeleteConfirmModal = ({
  open,
  playerName,
  hasHistory,
  isActive,
  onClose,
  onConfirmDelete,
  onConfirmDeactivate,
}: PlayerDeleteConfirmModalProps) => {
  const titleId = useId();
  const [pending, setPending] = useState<'delete' | 'deactivate' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: 'delete' | 'deactivate', fn: () => void | Promise<void>) => {
    setError(null);
    setPending(kind);
    try {
      await fn();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作に失敗しました。');
    } finally {
      setPending(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} testId="player-delete-modal">
      <div className="space-y-5">
        <div className="space-y-2">
          <h2 id={titleId} className="text-base font-semibold text-zinc-100">
            プレイヤーを削除
          </h2>
          <p className="text-sm text-zinc-300">
            <span className="font-medium text-zinc-100">{playerName}</span>{' '}
            を削除しようとしています。
          </p>
        </div>

        {hasHistory ? (
          <p
            data-testid="player-delete-history-notice"
            className="rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-100"
          >
            このプレイヤーは過去の対局に登場しているため物理削除はできません。
            <br />
            代わりに「非アクティブ化」すると新しい対局には選択できなくなり、過去の成績は保持されます。
          </p>
        ) : (
          <p className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300">
            このプレイヤーには対局履歴がありません。物理削除しても他のデータには影響しません。
          </p>
        )}

        {error !== null ? (
          <p
            role="alert"
            data-testid="player-delete-error"
            className="rounded-lg border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-200"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending !== null}
              className="rounded-full px-4 py-2 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={() => run('delete', onConfirmDelete)}
              disabled={pending !== null || hasHistory}
              data-testid="player-delete-confirm"
              className="rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending === 'delete' ? '削除中…' : '削除する'}
            </button>
          </div>
          {hasHistory && isActive ? (
            <button
              type="button"
              onClick={() => run('deactivate', onConfirmDeactivate)}
              disabled={pending !== null}
              data-testid="player-deactivate-confirm"
              className="rounded-full border border-amber-700/60 bg-amber-950/40 px-4 py-2 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending === 'deactivate' ? '更新中…' : '非アクティブにする'}
            </button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
};
