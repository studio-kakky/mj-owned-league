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
  const title = isCreate ? '新しいグループ' : 'グループを編集';
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
      <form onSubmit={handleSubmit} className="flex flex-col">
        {/* Header — title + close (design: FullScreenModal header). */}
        <div className="flex shrink-0 items-center gap-3 border-b border-[#1F1F1F] px-4 py-3.5">
          <h2 id={titleId} className="flex-1 text-[15px] font-semibold text-[#FAFAF8]">
            {title}
          </h2>
          <button
            type="button"
            aria-label="閉じる"
            onClick={onClose}
            disabled={isSubmitting}
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

        <div className="px-5 py-5">
          <p className="mb-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[#888888]">
            グループ名
          </p>
          <label htmlFor={inputId} className="sr-only">
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
            className="block h-10 w-full rounded-md border border-[#262626] bg-[#181818] px-3 text-sm text-[#FAFAF8] placeholder:text-[#666666] focus:border-[#3a3a3a] focus:outline-none"
            placeholder="例：金曜定例会"
          />
          <p className="mt-2 text-[11.5px] leading-relaxed text-[#666666]">{helperCopy}</p>

          {error !== null ? (
            <p
              role="alert"
              data-testid="group-form-error"
              className="mt-3 rounded border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-200"
            >
              {error}
            </p>
          ) : null}
        </div>

        {/* Footer — centred pill buttons (design). */}
        <div className="mb-4 flex shrink-0 justify-center gap-2 px-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-[34px] rounded-full border border-[#262626] px-3.5 text-[13px] font-medium text-[#FAFAF8] transition-colors hover:border-[#3a3a3a] disabled:cursor-not-allowed disabled:opacity-60"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            data-testid="group-form-submit"
            className="h-[34px] rounded-full bg-[#FAFAF8] px-[18px] text-[13px] font-semibold text-[#0E0E0E] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-[#2a2a2a] disabled:text-[#666666]"
          >
            {isSubmitting ? '送信中…' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
};
