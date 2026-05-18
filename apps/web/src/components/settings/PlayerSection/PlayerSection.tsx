/**
 * Player 管理 サブセクション on the S16 Settings screen (Issue #17).
 *
 * Inline-edit pattern: each row toggles between read mode (name + actions)
 * and edit mode (text input + save / cancel). The toggle lives in row-local
 * state so the rest of the list keeps rendering normally. This matches the
 * Issue body's bullet「Player 管理: 一覧 / 追加 / インライン編集 / 非アクティブ化 / 削除」.
 *
 * Add affordance is the same "＋" pill in the section header. We use a
 * minimal inline create input (revealed on click) rather than a separate
 * modal, since the only required field is `name` and the rest of the screen
 * is already busy with the Ruleset section's modals.
 *
 * Delete vs. deactivate: the dedicated `PlayerDeleteConfirmModal` enforces
 * the history-aware rule (`02-domain-model.md` § Player). Reactivation is
 * exposed inline on inactive rows so the Owner can flip the toggle without
 * a separate dialog.
 */

import { useState } from 'react';
import { PlayerDeleteConfirmModal } from '../PlayerDeleteConfirmModal';
import type { SettingsPlayerItem } from '../types';
import { PlayerCreateRow } from './PlayerCreateRow';
import { PlayerRow } from './PlayerRow';

export interface PlayerSectionProps {
  players: ReadonlyArray<SettingsPlayerItem>;
  /** Disables every write affordance — used when there is no active group. */
  disabled?: boolean;
  onCreate: (name: string) => void | Promise<void>;
  onRename: (playerId: string, name: string) => void | Promise<void>;
  onDelete: (playerId: string) => void | Promise<void>;
  onDeactivate: (playerId: string) => void | Promise<void>;
  onReactivate: (playerId: string) => void | Promise<void>;
}

export const PlayerSection = ({
  players,
  disabled = false,
  onCreate,
  onRename,
  onDelete,
  onDeactivate,
  onReactivate,
}: PlayerSectionProps) => {
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SettingsPlayerItem | null>(null);

  return (
    <section className="space-y-4" data-testid="settings-player-section">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Players</p>
          <h2 className="text-base font-semibold text-zinc-100">プレイヤー</h2>
          <p className="mt-1 text-xs text-zinc-500">グループに所属するメンバーを管理します。</p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          disabled={disabled}
          data-testid="player-create-trigger"
          aria-label="プレイヤーを追加"
          aria-expanded={creating}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-base font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          ＋
        </button>
      </header>

      {creating ? (
        <PlayerCreateRow
          onSubmit={async (name) => {
            await onCreate(name);
            setCreating(false);
          }}
          onCancel={() => setCreating(false)}
        />
      ) : null}

      {players.length === 0 ? (
        <div
          data-testid="player-empty-state"
          className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-4 text-center text-xs text-zinc-400"
        >
          プレイヤーがまだ登録されていません。「＋」から追加してください。
        </div>
      ) : (
        <ul className="space-y-2" data-testid="player-list">
          {players.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              disabled={disabled}
              onRename={(name) => onRename(player.id, name)}
              onAskDelete={() => setPendingDelete(player)}
              onDeactivate={() => onDeactivate(player.id)}
              onReactivate={() => onReactivate(player.id)}
            />
          ))}
        </ul>
      )}

      <PlayerDeleteConfirmModal
        open={pendingDelete !== null}
        playerName={pendingDelete?.name ?? ''}
        hasHistory={pendingDelete?.hasHistory ?? false}
        isActive={pendingDelete?.isActive ?? true}
        onClose={() => setPendingDelete(null)}
        onConfirmDelete={async () => {
          if (pendingDelete === null) return;
          await onDelete(pendingDelete.id);
          setPendingDelete(null);
        }}
        onConfirmDeactivate={async () => {
          if (pendingDelete === null) return;
          await onDeactivate(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </section>
  );
};
