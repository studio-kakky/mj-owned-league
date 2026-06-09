/**
 * S8 League 作成 modal (`04-screens.md` § S8, Issue #18).
 *
 * Form contract (per the issue acceptance criteria):
 *   - 名前 (required, 1-60 chars after trim)
 *   - 形式 (`4P_HANCHAN` / `4P_TONPU` / `3P_HANCHAN` / `3P_TONPU`)
 *   - Group (Owner picks which Group the League goes under)
 *   - デフォルト Ruleset (auto-pre-selected to the Group's default; the user
 *     can pick another Ruleset belonging to the same Group, or leave it
 *     unset, in which case the server falls back to the Group's default at
 *     create time)
 *
 *   `publicSlug` is NOT a form field — the spec calls for "publicSlug を
 *   自動採番"; the server generates it and the modal never sees it.
 *
 * Why a single create-only modal instead of a Group-form-style "create or
 * edit" component:
 *   - Edit is not part of Issue #18's acceptance criteria. The S7 detail
 *     view will eventually offer "League 編集"; we keep this modal focused
 *     on create so the edit form can grow whatever extra fields it needs
 *     (status, archived-at, etc.) without complicating the create path.
 *   - Sharing one modal between create + edit on the Group form was easy
 *     because Group only has one editable field. League has four, so the
 *     two flows would visually diverge soon.
 *
 * Why we don't pull in a form library:
 *   The MVP form has four fields with no cross-field validation. Controlled
 *   `useState` keeps the file readable and matches the rest of the
 *   modals in this codebase (`GroupFormModal`, `RulesetFormModal`).
 */

import { type FormEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { LEAGUE_FORMATS, type LeagueFormat } from '../../db/schema';
import { Modal } from '../groups/Modal';
import type { LeagueCreateInput, LeagueGroupOption, LeagueRulesetOptionWithGroup } from './types';

export interface LeagueFormModalProps {
  open: boolean;
  /**
   * Groups the Owner can pick from. Empty arrays render an inline notice
   * pointing the user at S4 instead of letting them submit.
   */
  groups: ReadonlyArray<LeagueGroupOption>;
  /** Every Ruleset across the Owner's Groups. Filtered client-side. */
  rulesets: ReadonlyArray<LeagueRulesetOptionWithGroup>;
  onClose: () => void;
  /**
   * Called with a validated payload. May return a Promise; the modal stays
   * open until it resolves and shows an inline error if it rejects.
   *
   * `defaultRulesetId` is `null` when the user did not explicitly pick one
   * — the server resolves the Group default in that case.
   */
  onSubmit: (input: LeagueCreateInput) => void | Promise<void>;
}

const FORMAT_LABELS: Readonly<Record<LeagueFormat, string>> = {
  '4P_HANCHAN': '4人 半荘',
  '4P_TONPU': '4人 東風',
  '3P_HANCHAN': '3人 半荘',
  '3P_TONPU': '3人 東風',
};

const NO_RULESET_VALUE = '__none__';

export const LeagueFormModal = ({
  open,
  groups,
  rulesets,
  onClose,
  onSubmit,
}: LeagueFormModalProps) => {
  const titleId = useId();
  const nameId = useId();
  const formatId = useId();
  const groupId = useId();
  const rulesetId = useId();

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Initial Group: pick the first option deterministically. The state is
  // reset whenever the modal re-opens so closing and reopening always lands
  // back on the same default selection.
  const initialGroup = groups[0]?.id ?? '';
  const [name, setName] = useState('');
  const [format, setFormat] = useState<LeagueFormat>('4P_HANCHAN');
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroup);
  const [selectedRulesetId, setSelectedRulesetId] = useState<string>(NO_RULESET_VALUE);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset on open and pre-select the Group's default Ruleset. Doing this in
  // an effect (rather than as derived state) means the user can still
  // override the Ruleset after the auto-selection happens without the
  // selection bouncing back on every render.
  useEffect(() => {
    if (!open) return;
    const initial = groups[0]?.id ?? '';
    setName('');
    setFormat('4P_HANCHAN');
    setSelectedGroupId(initial);
    const defaultRulesetForInitial = groups[0]?.defaultRulesetId ?? null;
    setSelectedRulesetId(defaultRulesetForInitial ?? NO_RULESET_VALUE);
    setError(null);
    setSubmitting(false);
    // Defer focus so the Modal primitive's own focus call runs first.
    Promise.resolve().then(() => inputRef.current?.focus());
  }, [open, groups]);

  // When the user changes the Group selection, re-seed the Ruleset dropdown
  // with that Group's default. We don't touch it if the current Ruleset
  // still belongs to the new Group — that would be an unwelcome surprise.
  const filteredRulesets = useMemo(
    () => rulesets.filter((r) => r.groupId === selectedGroupId),
    [rulesets, selectedGroupId],
  );

  const handleGroupChange = (nextGroupId: string) => {
    setSelectedGroupId(nextGroupId);
    const stillValid = rulesets.some(
      (r) => r.groupId === nextGroupId && r.id === selectedRulesetId,
    );
    if (stillValid) return;
    const nextGroup = groups.find((g) => g.id === nextGroupId);
    setSelectedRulesetId(nextGroup?.defaultRulesetId ?? NO_RULESET_VALUE);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError('リーグ名を入力してください。');
      return;
    }
    if (selectedGroupId === '') {
      setError('グループを選択してください。');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        groupId: selectedGroupId,
        name: trimmed,
        format,
        defaultRulesetId: selectedRulesetId === NO_RULESET_VALUE ? null : selectedRulesetId,
      });
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

  const fieldClass =
    'block h-10 w-full rounded-md border border-[#262626] bg-[#181818] px-3 text-sm text-[#FAFAF8] placeholder:text-[#666666] focus:border-[#3a3a3a] focus:outline-none';
  const labelClass =
    'mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[#888888]';

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} testId="league-create-modal">
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="flex shrink-0 items-center gap-3 border-b border-[#1F1F1F] px-4 py-3.5">
          <h2 id={titleId} className="flex-1 text-[15px] font-semibold text-[#FAFAF8]">
            新しいリーグを作る
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
          {groups.length === 0 ? (
            <p
              data-testid="league-form-no-groups"
              className="rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-100"
            >
              グループがまだありません。先にグループを作成してください。
            </p>
          ) : (
            <>
              <div className="mb-4">
                <label htmlFor={nameId} className={labelClass}>
                  名前
                </label>
                <input
                  ref={inputRef}
                  id={nameId}
                  type="text"
                  required
                  value={name}
                  maxLength={60}
                  onChange={(event) => setName(event.target.value)}
                  data-testid="league-form-name-input"
                  className={fieldClass}
                  placeholder="例：2026 春シーズン"
                />
              </div>

              <div className="mb-4">
                <label htmlFor={formatId} className={labelClass}>
                  標準対局形式
                </label>
                <select
                  id={formatId}
                  value={format}
                  onChange={(event) => setFormat(event.target.value as LeagueFormat)}
                  data-testid="league-form-format-input"
                  className={fieldClass}
                >
                  {LEAGUE_FORMATS.map((value) => (
                    <option key={value} value={value}>
                      {FORMAT_LABELS[value]}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[11px] text-[#666666]">
                  対局追加時の初期値として使用 (個別に変更可)
                </p>
              </div>

              <div className="mb-4">
                <label htmlFor={groupId} className={labelClass}>
                  グループ
                </label>
                <select
                  id={groupId}
                  value={selectedGroupId}
                  onChange={(event) => handleGroupChange(event.target.value)}
                  data-testid="league-form-group-input"
                  className={fieldClass}
                >
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor={rulesetId} className={labelClass}>
                  ルール
                </label>
                <select
                  id={rulesetId}
                  value={selectedRulesetId}
                  onChange={(event) => setSelectedRulesetId(event.target.value)}
                  data-testid="league-form-ruleset-input"
                  className={fieldClass}
                >
                  <option value={NO_RULESET_VALUE}>グループの既定を使用</option>
                  {filteredRulesets.map((ruleset) => (
                    <option key={ruleset.id} value={ruleset.id}>
                      {ruleset.name}
                      {ruleset.isGroupDefault ? '（既定）' : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[11px] text-[#666666]">
                  対局ごとに Ruleset を上書きできます。未指定の場合はグループの既定が使われます。
                </p>
              </div>
            </>
          )}

          {error !== null ? (
            <p
              role="alert"
              data-testid="league-form-error"
              className="mt-3 rounded border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-200"
            >
              {error}
            </p>
          ) : null}
        </div>

        <div className="mb-5 flex shrink-0 justify-center gap-2 px-4">
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
            disabled={isSubmitting || groups.length === 0}
            data-testid="league-form-submit"
            className="h-[34px] rounded-full bg-[#FAFAF8] px-[18px] text-[13px] font-semibold text-[#0E0E0E] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-[#2a2a2a] disabled:text-[#666666]"
          >
            {isSubmitting ? '送信中…' : '作成'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
