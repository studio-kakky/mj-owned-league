/**
 * S10 Match 作成 screen (`04-screens.md` § S10, `03-user-flow.md` § F5,
 * Issue #20).
 *
 * Form contract (per the issue acceptance criteria):
 *   - Match 名 (required, 1-60 chars after trim)
 *   - 所属グループ (preselected; can be changed unless a League was passed
 *     in via the route query)
 *   - 所属リーグ (optional; when set, the form locks `format` to the
 *     League's format and surfaces the auto-allocated `sequenceNumber`)
 *   - 開催日 (optional, `YYYY-MM-DD`)
 *   - メモ (optional, up to 240 chars)
 *   - デフォルト Ruleset (optional; falls back to League → Group default)
 *
 * Why a full-screen page instead of a modal:
 *   The spec (`04-screens.md` § S10) places this at `/leagues/:leagueId/matches/new`
 *   or `/groups/:groupId/matches/new`. The form has six fields and an
 *   in-page guidance block (the "参加者プール" callout), which would crowd
 *   the centered-card Modal primitive used for shorter forms (Group / League
 *   create). The S10 design (`MatchCreate.html`) also shows a full screen.
 *
 *   For MVP we host the page at the cross-Group route `/matches/new` and
 *   read `leagueId` / `groupId` from the query string. The two
 *   path-parametrised aliases the doc mentions can be added later as thin
 *   redirects without touching this component.
 *
 * Why the participant-pool block is read-only here:
 *   The doc's acceptance criterion "形式（4麻/3麻）と参加者プールはそのリーグ
 *   に従う" is about visibility, not selection. The actual per-Game
 *   participant picker lives in S11 対局結果入力 — Match creation only needs
 *   to confirm the pool is big enough to start adding games. We render the
 *   active Player count for the current Group and surface a blocking error
 *   when a 3-player format meets a pool below three.
 *
 * Empty state — Owner has no Groups:
 *   We surface the "S4 へどうぞ" empty state and disable the submit button
 *   rather than letting the user fight a form with no targets. Mirrors the
 *   {@link LeagueListScreen} empty-state branch.
 */

import { Link } from '@tanstack/react-router';
import { type FormEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { LEAGUE_FORMATS, type LeagueFormat } from '../../db/schema';
import type {
  MatchCreateContext,
  MatchCreateGroupOption,
  MatchCreateInput,
  MatchCreateLeagueOption,
  MatchCreateRulesetOption,
} from './types';

export interface MatchCreateScreenProps {
  data: MatchCreateContext;
  /**
   * Submitted with the validated payload when the user presses 「作成」.
   * Should resolve (typically with a navigate side-effect) on success and
   * reject with an Error whose `.message` we surface inline on failure.
   */
  onSubmit: (input: MatchCreateInput) => void | Promise<void>;
  /**
   * Called when the user presses 「キャンセル」. The route layer wires it
   * to a back-navigation (preferring the originating League detail when one
   * was supplied) rather than a hard-coded route.
   */
  onCancel: () => void;
}

const FORMAT_LABELS: Readonly<Record<LeagueFormat, string>> = {
  '4P_HANCHAN': '4人 半荘',
  '4P_TONPU': '4人 東風',
  '3P_HANCHAN': '3人 半荘',
  '3P_TONPU': '3人 東風',
};

/**
 * Sentinel value used inside the `<select>` for "no League" (= League 外 Match).
 * Picking an empty string would collide with the "no selection" state HTML
 * gives to disabled `<select>`s.
 */
const NO_LEAGUE_VALUE = '__no_league__';
const NO_RULESET_VALUE = '__no_ruleset__';

/**
 * Format-derived participant requirement. The S11 picker enforces the same
 * count when adding actual Games; we re-derive here purely to gate Match
 * creation with friendly copy. 4P / 3P formats are the only two buckets,
 * so the literal mapping is fine.
 */
function formatRequiresPlayers(format: LeagueFormat): number {
  return format.startsWith('3P') ? 3 : 4;
}

export function MatchCreateScreen({ data, onSubmit, onCancel }: MatchCreateScreenProps) {
  const nameId = useId();
  const groupId = useId();
  const leagueId = useId();
  const formatId = useId();
  const heldAtId = useId();
  const memoId = useId();
  const rulesetId = useId();

  const nameRef = useRef<HTMLInputElement | null>(null);

  const hasGroups = data.groups.length > 0;
  const lockedLeagueId = data.initialLeagueId;

  // The form state mirrors the loader's initial values exactly so a refresh
  // / back navigation lands on the same defaults the user originally saw.
  const [selectedGroupId, setSelectedGroupId] = useState<string>(data.initialGroupId ?? '');
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(
    data.initialLeagueId ?? NO_LEAGUE_VALUE,
  );
  const [name, setName] = useState('');
  const [heldAt, setHeldAt] = useState('');
  const [memo, setMemo] = useState('');
  const [selectedRulesetId, setSelectedRulesetId] = useState<string>(NO_RULESET_VALUE);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Defer focus to the field the user most likely wants to type into first.
  // Skipped when there are no Groups — the empty-state replaces the form.
  useEffect(() => {
    if (!hasGroups) return;
    Promise.resolve().then(() => nameRef.current?.focus());
  }, [hasGroups]);

  // ---------------------------------------------------------------------
  // Derived view state — Group / League / Ruleset filtering + the
  // participant-pool guidance.
  // ---------------------------------------------------------------------

  const groupById = useMemo(
    () => new Map(data.groups.map((g) => [g.id, g] as const)),
    [data.groups],
  );
  const leagueById = useMemo(
    () => new Map(data.leagues.map((l) => [l.id, l] as const)),
    [data.leagues],
  );

  const selectedGroup: MatchCreateGroupOption | null = selectedGroupId
    ? (groupById.get(selectedGroupId) ?? null)
    : null;

  const selectedLeague: MatchCreateLeagueOption | null =
    selectedLeagueId === NO_LEAGUE_VALUE ? null : (leagueById.get(selectedLeagueId) ?? null);

  /**
   * Leagues filtered to the currently-selected Group. A League cannot
   * belong to a Group other than its own, so the dropdown always reflects
   * the Group choice.
   */
  const leaguesForGroup = useMemo(
    () => data.leagues.filter((l) => l.groupId === selectedGroupId),
    [data.leagues, selectedGroupId],
  );

  /**
   * Rulesets filtered to the currently-selected Group. Same logic as the
   * League dropdown — the form never offers cross-Group rulesets.
   */
  const rulesetsForGroup = useMemo<ReadonlyArray<MatchCreateRulesetOption>>(
    () => data.rulesets.filter((r) => r.groupId === selectedGroupId),
    [data.rulesets, selectedGroupId],
  );

  /**
   * Effective format. When a League is selected, the form locks the
   * format to the League's. Otherwise the user picks one (defaulting to
   * `4P_HANCHAN`).
   */
  const [explicitFormat, setExplicitFormat] = useState<LeagueFormat>('4P_HANCHAN');
  const effectiveFormat: LeagueFormat = selectedLeague?.format ?? explicitFormat;
  const requiredPlayers = formatRequiresPlayers(effectiveFormat);

  /**
   * Active-Player count for the currently-selected Group. Zero when no
   * Group is selected or when the Owner just created one without players.
   */
  const activePlayerCount = selectedGroupId
    ? (data.activePlayerCountByGroup[selectedGroupId] ?? 0)
    : 0;
  const isPoolTooSmall = activePlayerCount < requiredPlayers;

  /**
   * Auto-allocated sequenceNumber surfaced for the League-scoped flow. We
   * surface it inline so the user can sanity-check the value before
   * pressing 「作成」 (the loader runs once; if a sibling tab created a
   * Match in the meantime, the user can refresh).
   */
  const sequenceNumberDisplay =
    selectedLeague !== null && selectedLeagueId === lockedLeagueId
      ? data.initialSequenceNumber
      : null;

  // ---------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------

  const handleGroupChange = (nextGroupId: string) => {
    if (lockedLeagueId !== null) return;
    setSelectedGroupId(nextGroupId);
    // Switching Group invalidates the current League / Ruleset selection.
    setSelectedLeagueId(NO_LEAGUE_VALUE);
    setSelectedRulesetId(NO_RULESET_VALUE);
  };

  const handleLeagueChange = (nextLeagueId: string) => {
    if (lockedLeagueId !== null) return;
    setSelectedLeagueId(nextLeagueId);
    // Keep the user's Ruleset choice if it still matches the active Group.
    // Picking a League never moves the Group, so no further state shifts
    // are needed here.
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      setError('マッチ名を入力してください。');
      return;
    }
    if (selectedGroupId === '') {
      setError('グループを選択してください。');
      return;
    }
    if (isPoolTooSmall) {
      setError(
        `${effectiveFormat.startsWith('3P') ? '3人' : '4人'}麻雀には ${requiredPlayers} 人以上のアクティブなプレイヤーが必要です。プレイヤーを追加してから作成してください。`,
      );
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        groupId: selectedGroupId,
        leagueId: selectedLeagueId === NO_LEAGUE_VALUE ? null : selectedLeagueId,
        name: trimmedName,
        heldAt: heldAt.length > 0 ? heldAt : null,
        memo: memo.trim().length > 0 ? memo.trim() : null,
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

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  if (!hasGroups) {
    return (
      <section className="space-y-5" data-testid="match-create-screen">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Match</p>
          <h1 className="text-2xl font-bold text-zinc-50">マッチを作成</h1>
        </header>
        <div
          data-testid="match-create-empty-no-groups"
          className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-400"
        >
          <p className="font-medium text-zinc-200">グループがまだありません</p>
          <p className="mt-1 text-xs text-zinc-500">
            マッチはグループ配下に作成します。先にグループを作成してください。
          </p>
          <Link
            to="/groups"
            className="mt-3 inline-block rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
          >
            グループへ移動
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" data-testid="match-create-screen">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Match</p>
        <h1 className="text-2xl font-bold text-zinc-50">マッチを作成</h1>
        <p className="text-sm text-zinc-400">
          リーグ配下のマッチは形式と参加者プールをリーグから引き継ぎます。
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5" data-testid="match-create-form">
        <div className="space-y-2">
          <label htmlFor={nameId} className="block text-xs font-medium text-zinc-300">
            マッチ名
          </label>
          <input
            ref={nameRef}
            id={nameId}
            type="text"
            required
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            data-testid="match-form-name-input"
            className="block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
            placeholder="例: 第 2 節"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor={groupId} className="block text-xs font-medium text-zinc-300">
            所属グループ
          </label>
          <select
            id={groupId}
            value={selectedGroupId}
            onChange={(event) => handleGroupChange(event.target.value)}
            disabled={lockedLeagueId !== null}
            data-testid="match-form-group-input"
            className="block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {data.groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          {lockedLeagueId !== null ? (
            <p className="text-[11px] text-zinc-500">
              リーグから遷移したため、所属グループは固定されています。
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor={leagueId} className="block text-xs font-medium text-zinc-300">
            所属リーグ
          </label>
          <select
            id={leagueId}
            value={selectedLeagueId}
            onChange={(event) => handleLeagueChange(event.target.value)}
            disabled={lockedLeagueId !== null}
            data-testid="match-form-league-input"
            className="block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value={NO_LEAGUE_VALUE}>リーグなし（カジュアル対局）</option>
            {leaguesForGroup.map((league) => (
              <option key={league.id} value={league.id}>
                {league.name}（{FORMAT_LABELS[league.format]}）
              </option>
            ))}
          </select>
          <p className="text-[11px] text-zinc-500">
            リーグを選ぶと、形式（4人 / 3人）はリーグに合わせて固定されます。
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor={formatId} className="block text-xs font-medium text-zinc-300">
            形式
          </label>
          <select
            id={formatId}
            value={effectiveFormat}
            onChange={(event) => setExplicitFormat(event.target.value as LeagueFormat)}
            disabled={selectedLeague !== null}
            data-testid="match-form-format-input"
            className="block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {LEAGUE_FORMATS.map((value) => (
              <option key={value} value={value}>
                {FORMAT_LABELS[value]}
              </option>
            ))}
          </select>
          {selectedLeague !== null ? (
            <p className="text-[11px] text-zinc-500">
              リーグの形式に従います: {FORMAT_LABELS[selectedLeague.format]}
            </p>
          ) : null}
        </div>

        {/* Participant-pool guidance */}
        <div
          data-testid="match-form-pool"
          className={
            isPoolTooSmall
              ? 'rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-100'
              : 'rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-400'
          }
        >
          <p className="font-medium text-zinc-200">参加者プール</p>
          <p className="mt-1">
            {selectedGroup === null
              ? 'グループ未選択'
              : `${selectedGroup.name} のアクティブなプレイヤー ${activePlayerCount} 人 / 必要 ${requiredPlayers} 人`}
          </p>
          {isPoolTooSmall ? (
            <p data-testid="match-form-pool-warning" className="mt-1 text-amber-200">
              {effectiveFormat.startsWith('3P') ? '3人' : '4人'}麻雀には{requiredPlayers}{' '}
              人以上のアクティブなプレイヤーが必要です。先に「設定 → プレイヤー管理」で
              {requiredPlayers - activePlayerCount} 人以上追加してください。
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor={heldAtId} className="block text-xs font-medium text-zinc-300">
            開催日 <span className="text-zinc-600">(任意)</span>
          </label>
          <input
            id={heldAtId}
            type="date"
            value={heldAt}
            onChange={(event) => setHeldAt(event.target.value)}
            data-testid="match-form-helddate-input"
            className="block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor={memoId} className="block text-xs font-medium text-zinc-300">
            メモ <span className="text-zinc-600">(任意)</span>
          </label>
          <textarea
            id={memoId}
            value={memo}
            maxLength={240}
            rows={2}
            onChange={(event) => setMemo(event.target.value)}
            data-testid="match-form-memo-input"
            className="block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
            placeholder="例: 会場 / 出席メンバーのメモ"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor={rulesetId} className="block text-xs font-medium text-zinc-300">
            デフォルト Ruleset <span className="text-zinc-600">(任意)</span>
          </label>
          <select
            id={rulesetId}
            value={selectedRulesetId}
            onChange={(event) => setSelectedRulesetId(event.target.value)}
            data-testid="match-form-ruleset-input"
            className="block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
          >
            <option value={NO_RULESET_VALUE}>リーグ / グループの既定を使用</option>
            {rulesetsForGroup.map((ruleset) => (
              <option key={ruleset.id} value={ruleset.id}>
                {ruleset.name}
                {ruleset.isGroupDefault ? '（既定）' : ''}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-zinc-500">
            未指定の場合は、所属リーグの既定 → グループの既定、の順で適用されます。
          </p>
        </div>

        {sequenceNumberDisplay !== null ? (
          <p data-testid="match-form-sequence-number" className="text-[11px] text-zinc-500">
            このマッチは「第 {sequenceNumberDisplay} 節」として登録されます（自動採番）。
          </p>
        ) : null}

        {error !== null ? (
          <p
            role="alert"
            data-testid="match-form-error"
            className="rounded-lg border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-200"
          >
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-full px-4 py-2 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isPoolTooSmall}
            data-testid="match-form-submit"
            className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? '送信中…' : '作成'}
          </button>
        </div>
      </form>
    </section>
  );
}
