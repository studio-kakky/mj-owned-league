import { useEffect, useId, useRef, useState } from 'react';
import type { SettingsPlayerItem } from '../types';

interface PlayerRowProps {
  player: SettingsPlayerItem;
  disabled: boolean;
  onRename: (name: string) => void | Promise<void>;
  onAskDelete: () => void;
  onDeactivate: () => void | Promise<void>;
  onReactivate: () => void | Promise<void>;
}

export const PlayerRow = ({
  player,
  disabled,
  onRename,
  onAskDelete,
  onDeactivate,
  onReactivate,
}: PlayerRowProps) => {
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
};
