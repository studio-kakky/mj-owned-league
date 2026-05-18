/**
 * Modal form used for both S5 Group 作成 and the Group 編集 flow on S4.
 *
 * Single component instead of two near-identical ones because the
 * difference between create and edit is literally just (a) the initial
 * value, (b) the submit button label, and (c) the dialog title. Sharing
 * one component keeps Group-name validation in exactly one place.
 *
 * Form contract:
 *   - The Group name is required (`trim().length > 0`).
 *   - Empty submissions are rejected client-side; the input also gets the
 *     `required` attribute so browser-level "fill out this field" hints
 *     fire in addition to our own.
 *   - `onSubmit` returns a Promise; the modal awaits it and stays open if
 *     the promise rejects, so the parent can render a contextual error
 *     without the modal disappearing under the user.
 *
 * Why we don't drop in a form library (react-hook-form, etc.):
 *   The MVP has exactly one editable text field. A controlled `useState`
 *   pair is shorter and clearer; we can introduce a library when a form
 *   with cross-field validation lands.
 */

import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { Modal } from './Modal';

export type GroupFormMode = 'create' | 'edit';

export interface GroupFormModalProps {
  open: boolean;
  mode: GroupFormMode;
  /** Pre-fill value for edit; ignored when `mode === 'create'`. */
  initialName?: string;
  onClose: () => void;
  /**
   * Called with the trimmed name when the user submits a valid form. May
   * return a Promise; the modal disables the submit button while the
   * promise is pending and keeps the modal open if it rejects.
   *
   * The parent decides what to do with the value (call the service,
   * navigate, etc.); this component does not touch the data layer.
   */
  onSubmit: (name: string) => void | Promise<void>;
}

export const GroupFormModal = ({
  open,
  mode,
  initialName,
  onClose,
  onSubmit,
}: GroupFormModalProps) => {
  const titleId = useId();
  const inputId = useId();
  // Programmatic focus rather than the JSX `autoFocus` attribute. Biome's
  // `noAutofocus` a11y rule rightly flags `autoFocus` as a footgun: when the
  // modal mounts inside an already-focused page, screen readers can land on
  // the field before the dialog landmark has been announced. By moving focus
  // ourselves *after* the Modal primitive has set focus on the dialog body,
  // we cooperate with the dialog announcement instead of preempting it.
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState(initialName ?? '');
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form whenever the modal is re-opened. Without this, closing
  // the edit modal on one Group and opening it on another would render the
  // previous group's name as the seed value on the second open.
  useEffect(() => {
    if (open) {
      setName(initialName ?? '');
      setError(null);
      setSubmitting(false);
      // Defer to the next tick so the Modal's own focus call has already
      // happened. This second hop lands focus on the input, which is the
      // ergonomic landing spot for "start typing the group name".
      Promise.resolve().then(() => inputRef.current?.focus());
    }
  }, [open, initialName]);

  const isCreate = mode === 'create';
  const title = isCreate ? 'グループを作成' : 'グループを編集';
  const submitLabel = isCreate ? '作成' : '保存';
  const helperCopy = isCreate
    ? 'グループ作成と同時に既定のルールセット「標準ルール」も自動で作成されます。'
    : 'グループ名を更新します。所属するプレイヤーや対局はそのまま保持されます。';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError('グループ名を入力してください。');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
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
      testId={isCreate ? 'group-create-modal' : 'group-edit-modal'}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1">
          <h2 id={titleId} className="text-base font-semibold text-zinc-100">
            {title}
          </h2>
          <p className="text-xs text-zinc-500">{helperCopy}</p>
        </div>

        <div className="space-y-2">
          <label htmlFor={inputId} className="block text-xs font-medium text-zinc-300">
            グループ名
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            required
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            data-testid="group-form-name-input"
            className="block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
            placeholder="例: 金曜定例会"
          />
        </div>

        {error !== null ? (
          <p
            role="alert"
            data-testid="group-form-error"
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
            data-testid="group-form-submit"
            className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? '送信中…' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
};
