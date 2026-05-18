/**
 * Form modal for creating / editing a Ruleset (Issue #17, S16 Settings).
 *
 * One component handles both create and edit because the only difference is
 * the initial values and the title — same approach as `GroupFormModal`.
 *
 * Form contract:
 *   - All numeric inputs are required and positive integers.
 *   - `tobiPoint` is only required when `tobiEnabled` is on. Toggling the
 *     switch off clears `tobiPoint` so the parent sees `null` per
 *     `02-domain-model.md` § Ruleset (and per `TobiConfigurationError`).
 *   - `onSubmit` returns a Promise; the modal stays open if it rejects so
 *     server-side validation (e.g. `TobiConfigurationError`) surfaces in
 *     the error region.
 *
 * UMA patterns are surfaced as a `<select>` populated from `UMA_PATTERNS`
 * (the schema-level source of truth) so adding a pattern in the schema
 * automatically shows up here.
 */

import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { UMA_PATTERNS, type UmaPattern } from '../../db/schema';
import { Modal } from './Modal';
import type { RulesetFormInput } from './types';

export type RulesetFormMode = 'create' | 'edit';

export interface RulesetFormModalProps {
  open: boolean;
  mode: RulesetFormMode;
  /** Pre-fill values for edit; ignored when `mode === 'create'`. */
  initialValues?: RulesetFormInput;
  onClose: () => void;
  /**
   * Called with the validated form payload on submit. May return a Promise;
   * the modal disables the submit button while pending and keeps the modal
   * open if it rejects, surfacing `error.message` in the alert region.
   */
  onSubmit: (input: RulesetFormInput) => void | Promise<void>;
}

const DEFAULT_VALUES: RulesetFormInput = {
  name: '',
  startingScore: 25000,
  returnScore: 30000,
  umaPattern: 'UMA_10_30',
  tobiEnabled: false,
  tobiPoint: null,
};

export const RulesetFormModal = ({
  open,
  mode,
  initialValues,
  onClose,
  onSubmit,
}: RulesetFormModalProps) => {
  const titleId = useId();
  const nameId = useId();
  const startingId = useId();
  const returnId = useId();
  const umaId = useId();
  const tobiPointId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [values, setValues] = useState<RulesetFormInput>(initialValues ?? DEFAULT_VALUES);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form whenever the modal re-opens. Without this, editing one
  // ruleset and then opening the create modal would seed the create form
  // with the previous edit values.
  useEffect(() => {
    if (open) {
      setValues(initialValues ?? DEFAULT_VALUES);
      setError(null);
      setSubmitting(false);
      Promise.resolve().then(() => inputRef.current?.focus());
    }
  }, [open, initialValues]);

  const isCreate = mode === 'create';
  const title = isCreate ? 'ルールセットを追加' : 'ルールセットを編集';
  const submitLabel = isCreate ? '追加' : '保存';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = values.name.trim();
    if (trimmedName.length === 0) {
      setError('ルールセット名を入力してください。');
      return;
    }
    if (!Number.isFinite(values.startingScore) || values.startingScore <= 0) {
      setError('配給原点は正の整数で入力してください。');
      return;
    }
    if (!Number.isFinite(values.returnScore) || values.returnScore <= 0) {
      setError('返し点は正の整数で入力してください。');
      return;
    }
    if (values.tobiEnabled && (values.tobiPoint === null || !Number.isFinite(values.tobiPoint))) {
      setError('飛び賞を有効にした場合は飛び賞ポイントを入力してください。');
      return;
    }

    const normalised: RulesetFormInput = {
      name: trimmedName,
      startingScore: Math.trunc(values.startingScore),
      returnScore: Math.trunc(values.returnScore),
      umaPattern: values.umaPattern,
      tobiEnabled: values.tobiEnabled,
      // Force null when disabled, regardless of any stale numeric state.
      tobiPoint: values.tobiEnabled ? (values.tobiPoint ?? 0) : null,
    };

    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(normalised);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : '送信中にエラーが発生しました。時間をおいて再度お試しください。',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      testId={isCreate ? 'ruleset-create-modal' : 'ruleset-edit-modal'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <h2 id={titleId} className="text-base font-semibold text-zinc-100">
            {title}
          </h2>
          <p className="text-xs text-zinc-500">
            アクティブグループ内で使えるルールテンプレートを管理します。
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor={nameId} className="block text-xs font-medium text-zinc-300">
            名称
          </label>
          <input
            ref={inputRef}
            id={nameId}
            type="text"
            required
            value={values.name}
            maxLength={60}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            data-testid="ruleset-form-name"
            className="block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
            placeholder="例: 標準ルール"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label htmlFor={startingId} className="block text-xs font-medium text-zinc-300">
              配給原点
            </label>
            <input
              id={startingId}
              type="number"
              required
              inputMode="numeric"
              min={1}
              value={values.startingScore}
              onChange={(e) =>
                setValues((v) => ({ ...v, startingScore: Number(e.target.value) || 0 }))
              }
              data-testid="ruleset-form-starting"
              className="block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor={returnId} className="block text-xs font-medium text-zinc-300">
              返し点
            </label>
            <input
              id={returnId}
              type="number"
              required
              inputMode="numeric"
              min={1}
              value={values.returnScore}
              onChange={(e) =>
                setValues((v) => ({ ...v, returnScore: Number(e.target.value) || 0 }))
              }
              data-testid="ruleset-form-return"
              className="block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor={umaId} className="block text-xs font-medium text-zinc-300">
            ウマパターン
          </label>
          <select
            id={umaId}
            value={values.umaPattern}
            onChange={(e) => setValues((v) => ({ ...v, umaPattern: e.target.value as UmaPattern }))}
            data-testid="ruleset-form-uma"
            className="block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
          >
            {UMA_PATTERNS.map((pattern) => (
              <option key={pattern} value={pattern}>
                {pattern}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          <label className="flex items-center gap-2 text-xs text-zinc-200">
            <input
              type="checkbox"
              checked={values.tobiEnabled}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  tobiEnabled: e.target.checked,
                  tobiPoint: e.target.checked ? (v.tobiPoint ?? 0) : null,
                }))
              }
              data-testid="ruleset-form-tobi-enabled"
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
            />
            飛び賞を適用する
          </label>
          {values.tobiEnabled ? (
            <div className="space-y-1">
              <label htmlFor={tobiPointId} className="block text-[11px] text-zinc-400">
                飛び賞ポイント
              </label>
              <input
                id={tobiPointId}
                type="number"
                inputMode="decimal"
                step="0.1"
                value={values.tobiPoint ?? 0}
                onChange={(e) => setValues((v) => ({ ...v, tobiPoint: Number(e.target.value) }))}
                data-testid="ruleset-form-tobi-point"
                className="block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          ) : null}
        </div>

        {error !== null ? (
          <p
            role="alert"
            data-testid="ruleset-form-error"
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
            type="submit"
            disabled={isSubmitting}
            data-testid="ruleset-form-submit"
            className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? '送信中…' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
};
