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

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} testId="league-create-modal">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1">
          <h2 id={titleId} className="text-base font-semibold text-zinc-100">
            リーグを作成
          </h2>
          <p className="text-xs text-zinc-500">
            形式と Ruleset は作成後に編集できません。最初の対局を追加すると形式は固定されます。
          </p>
        </div>

        {groups.length === 0 ? (
          <p
            data-testid="league-form-no-groups"
            className="rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-100"
          >
            グループがまだありません。先にグループを作成してください。
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <label htmlFor={nameId} className="block text-xs font-medium text-zinc-300">
                リーグ名
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
                className="block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
                placeholder="例: 2026 春シーズン"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor={formatId} className="block text-xs font-medium text-zinc-300">
                形式
              </label>
              <select
                id={formatId}
                value={format}
                onChange={(event) => setFormat(event.target.value as LeagueFormat)}
                data-testid="league-form-format-input"
                className="block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
              >
                {LEAGUE_FORMATS.map((value) => (
                  <option key={value} value={value}>
                    {FORMAT_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor={groupId} className="block text-xs font-medium text-zinc-300">
                所属グループ
              </label>
              <select
                id={groupId}
                value={selectedGroupId}
                onChange={(event) => handleGroupChange(event.target.value)}
                data-testid="league-form-group-input"
                className="block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor={rulesetId} className="block text-xs font-medium text-zinc-300">
                デフォルト Ruleset
              </label>
              <select
                id={rulesetId}
                value={selectedRulesetId}
                onChange={(event) => setSelectedRulesetId(event.target.value)}
                data-testid="league-form-ruleset-input"
                className="block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
              >
                <option value={NO_RULESET_VALUE}>グループの既定を使用</option>
                {filteredRulesets.map((ruleset) => (
                  <option key={ruleset.id} value={ruleset.id}>
                    {ruleset.name}
                    {ruleset.isGroupDefault ? '（既定）' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-zinc-500">
                対局ごとに Ruleset を上書きできます。未指定の場合はグループの既定が使われます。
              </p>
            </div>
          </>
        )}

        {error !== null ? (
          <p
            role="alert"
            data-testid="league-form-error"
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
            disabled={isSubmitting || groups.length === 0}
            data-testid="league-form-submit"
            className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? '送信中…' : '作成'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
