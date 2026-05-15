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

import { useEffect, useId, useRef, useState } from 'react';
import { PlayerDeleteConfirmModal } from './PlayerDeleteConfirmModal';
import type { SettingsPlayerItem } from './types';

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

export function PlayerSection({
  players,
  disabled = false,
  onCreate,
  onRename,
  onDelete,
  onDeactivate,
  onReactivate,
}: PlayerSectionProps) {
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
}

// ---------------------------------------------------------------------------
// Row primitives — kept in this file so the component graph stays flat. They
// are small enough that extracting them does not pay rent.
// ---------------------------------------------------------------------------

interface PlayerRowProps {
  player: SettingsPlayerItem;
  disabled: boolean;
  onRename: (name: string) => void | Promise<void>;
  onAskDelete: () => void;
  onDeactivate: () => void | Promise<void>;
  onReactivate: () => void | Promise<void>;
}

function PlayerRow({
  player,
  disabled,
  onRename,
  onAskDelete,
  onDeactivate,
  onReactivate,
}: PlayerRowProps) {
  const [isEditing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(player.name);
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useId();

  useEffect(() => {
    if (isEditing) {
      setDraftName(player.name);
      setError(null);
      Promise.resolve().then(() => inputRef.current?.focus());
    }
  }, [isEditing, player.name]);

  const handleSave = async () => {
    const trimmed = draftName.trim();
    if (trimmed.length === 0) {
      setError('名前を入力してください。');
      return;
    }
    if (trimmed === player.name) {
      // Nothing to save — just collapse.
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onRename(trimmed);
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '更新に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <li
      data-testid={`player-list-item-${player.id}`}
      className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3"
    >
      {isEditing ? (
        <div className="space-y-2">
          <label htmlFor={inputId} className="block text-[11px] text-zinc-400">
            プレイヤー名
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            value={draftName}
            maxLength={40}
            onChange={(e) => setDraftName(e.target.value)}
            data-testid={`player-rename-input-${player.id}`}
            className="block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
          />
          {error !== null ? (
            <p
              role="alert"
              data-testid={`player-rename-error-${player.id}`}
              className="rounded-lg border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-200"
            >
              {error}
            </p>
          ) : null}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={isSaving}
              className="rounded-full px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              data-testid={`player-rename-save-${player.id}`}
              className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p
                className={`truncate text-sm font-medium ${
                  player.isActive ? 'text-zinc-100' : 'text-zinc-500 line-through'
                }`}
              >
                {player.name}
              </p>
              {!player.isActive ? (
                <span
                  data-testid={`player-inactive-badge-${player.id}`}
                  className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400"
                >
                  非アクティブ
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={disabled}
              data-testid={`player-edit-trigger-${player.id}`}
              aria-label={`${player.name} を編集`}
              className="rounded-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              編集
            </button>
            {player.isActive ? (
              <button
                type="button"
                onClick={onDeactivate}
                disabled={disabled}
                data-testid={`player-deactivate-trigger-${player.id}`}
                aria-label={`${player.name} を非アクティブにする`}
                className="rounded-full px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-950/40 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                非アクティブ
              </button>
            ) : (
              <button
                type="button"
                onClick={onReactivate}
                disabled={disabled}
                data-testid={`player-reactivate-trigger-${player.id}`}
                aria-label={`${player.name} を再アクティブ化する`}
                className="rounded-full px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-950/40 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                再アクティブ
              </button>
            )}
            <button
              type="button"
              onClick={onAskDelete}
              disabled={disabled}
              data-testid={`player-delete-trigger-${player.id}`}
              aria-label={`${player.name} を削除`}
              className="rounded-full px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-950/40 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              削除
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

interface PlayerCreateRowProps {
  onSubmit: (name: string) => void | Promise<void>;
  onCancel: () => void;
}

function PlayerCreateRow({ onSubmit, onCancel }: PlayerCreateRowProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve().then(() => inputRef.current?.focus());
  }, []);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError('名前を入力してください。');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'プレイヤーの追加に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      data-testid="player-create-row"
      className="space-y-2 rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-3"
    >
      <label htmlFor={inputId} className="block text-[11px] text-emerald-200">
        新しいプレイヤー名
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        data-testid="player-create-input"
        className="block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
        placeholder="例: たかし"
      />
      {error !== null ? (
        <p
          role="alert"
          data-testid="player-create-error"
          className="rounded-lg border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-200"
        >
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-full px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          data-testid="player-create-submit"
          className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? '追加中…' : '追加'}
        </button>
      </div>
    </div>
  );
}
