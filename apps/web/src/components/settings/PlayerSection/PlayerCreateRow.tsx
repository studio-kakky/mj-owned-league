import { useEffect, useId, useRef, useState } from 'react';

interface PlayerCreateRowProps {
  onSubmit: (name: string) => void | Promise<void>;
  onCancel: () => void;
}

export const PlayerCreateRow = ({ onSubmit, onCancel }: PlayerCreateRowProps) => {
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
};
