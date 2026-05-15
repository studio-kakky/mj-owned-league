/**
 * S11 対局結果入力 + S12 対局結果編集 modal
 * (`04-screens.md` § S11 / S12, `03-user-flow.md` § F6 / F7, Issue #19).
 *
 * The two screens share a single modal: S11 starts with empty fields, S12
 * starts pre-filled from {@link GameFormModalProps.initialGame}. The doc says
 * "S11 と同じフォーム、現在値が初期値" verbatim, so this avoids two parallel
 * files diverging over time.
 *
 * Form contract (per the issue acceptance criteria):
 *   - プレイヤー選択（4 人 or 3 人、形式に合わせて）
 *   - 各プレイヤーの素点入力 (`rawScore`)
 *   - 飛び賞 (`tobi`) — Ruleset が tobi 対応のときのみ ON/OFF + 飛ばした / 飛んだ人を選択
 *   - 適用 Ruleset 選択（Match 既定が初期値）
 *
 * Save-time validation (matches `02-domain-model.md` § GameResult):
 *   1. 全プレイヤーが選ばれている
 *   2. 同じプレイヤーが重複していない（タイトル: 同点では*ない*、重複選択の話）
 *   3. `Σ rawScore === startingScore × 人数`  → エラーバナーで保存ブロック
 *   4. 同点（同じ素点が複数）はエラーバナーで保存ブロック（issue 受け入れ基準）
 *
 *   ※ rankWithUma は理論的に tie 対応だが、Issue #19 の受け入れ基準で
 *     「同点 / 合計不一致のエラーバナーで保存ブロック」が明記されている。
 *     ユーザーが意図せず同点を入力した場合の保存ミスを防ぐためのガード。
 *
 * Why we don't compute the final points client-side:
 *   The server re-runs `calculateGamePoints` so the canonical numbers come
 *   from a single source. The modal could preview them, but that would
 *   duplicate the calculator across the wire boundary and force keeping the
 *   two in lockstep. Saving the round trip is not worth the risk for a
 *   once-per-game form.
 */

import { type FormEvent, useEffect, useId, useMemo, useState } from 'react';
import type { TobiRole } from '../../db/schema';
import { Modal } from '../groups/Modal';
import type {
  GameSubmitInput,
  GameSubmitPlayer,
  MatchGameRow,
  MatchPlayerOption,
  MatchRulesetOption,
} from './detail-types';

export interface GameFormModalProps {
  open: boolean;
  matchId: string;
  /** Number of players the format demands (3 or 4). */
  expectedPlayerCount: number;
  availablePlayers: ReadonlyArray<MatchPlayerOption>;
  availableRulesets: ReadonlyArray<MatchRulesetOption>;
  /** Ruleset id pre-selected when the modal opens fresh. `null` => none available. */
  defaultRulesetId: string | null;
  /** ISO date string pre-filled into `playedAt`. */
  defaultPlayedAt: string;
  /**
   * Populated for S12 edit mode. The modal pre-fills every field from this
   * snapshot. `null` is S11 create mode.
   */
  initialGame: MatchGameRow | null;
  onClose: () => void;
  /** Returns a Promise; the modal stays open until it resolves / rejects. */
  onSubmit: (input: GameSubmitInput) => void | Promise<void>;
}

type PlayerSlot = {
  playerId: string;
  /** Empty string when the user has not filled the field yet. */
  rawScoreInput: string;
  tobiRole: TobiRole | null;
};

const EMPTY_SLOT: PlayerSlot = { playerId: '', rawScoreInput: '', tobiRole: null };

export function GameFormModal({
  open,
  matchId,
  expectedPlayerCount,
  availablePlayers,
  availableRulesets,
  defaultRulesetId,
  defaultPlayedAt,
  initialGame,
  onClose,
  onSubmit,
}: GameFormModalProps) {
  const titleId = useId();
  const rulesetFieldId = useId();
  const playedAtFieldId = useId();

  const [slots, setSlots] = useState<PlayerSlot[]>(() =>
    Array.from({ length: expectedPlayerCount }, () => ({ ...EMPTY_SLOT })),
  );
  const [rulesetId, setRulesetId] = useState<string>(defaultRulesetId ?? '');
  const [playedAt, setPlayedAt] = useState<string>(defaultPlayedAt);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset whenever the modal re-opens. We seed from `initialGame` for edit
  // mode and from the defaults for create mode. Effect dependencies are
  // intentionally narrow so a parent re-render with the same `open` value
  // does not bounce the user's in-progress edits.
  useEffect(() => {
    if (!open) return;
    if (initialGame !== null) {
      const next: PlayerSlot[] = initialGame.results.map((r) => ({
        playerId: r.playerId,
        rawScoreInput: String(r.rawScore),
        tobiRole: r.tobiRole,
      }));
      // Pad with empty slots if the existing game has fewer entries than the
      // current expected count (shouldn't happen unless a Match was opened
      // before the format changed, but defensively).
      while (next.length < expectedPlayerCount) {
        next.push({ ...EMPTY_SLOT });
      }
      setSlots(next.slice(0, expectedPlayerCount));
      setRulesetId(initialGame.rulesetId);
      setPlayedAt(initialGame.playedAt.slice(0, 10));
    } else {
      setSlots(Array.from({ length: expectedPlayerCount }, () => ({ ...EMPTY_SLOT })));
      setRulesetId(defaultRulesetId ?? '');
      setPlayedAt(defaultPlayedAt);
    }
    setError(null);
    setSubmitting(false);
  }, [open, initialGame, expectedPlayerCount, defaultRulesetId, defaultPlayedAt]);

  const selectedRuleset = useMemo(
    () => availableRulesets.find((r) => r.id === rulesetId) ?? null,
    [availableRulesets, rulesetId],
  );

  const updateSlot = (index: number, patch: Partial<PlayerSlot>) => {
    setSlots((prev) => prev.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (selectedRuleset === null) {
      setError('Ruleset を選択してください。');
      return;
    }

    // All slots must have a player selected.
    if (slots.some((s) => s.playerId === '')) {
      setError(`プレイヤーを ${expectedPlayerCount} 人選択してください。`);
      return;
    }

    // Duplicate player check.
    const playerIds = slots.map((s) => s.playerId);
    if (new Set(playerIds).size !== playerIds.length) {
      setError('同じプレイヤーを 2 回以上選べません。');
      return;
    }

    // Parse raw scores. We accept negative numbers (busted-out players) but
    // require integer-ish input — Number.isFinite catches NaN / Infinity.
    const rawScores: number[] = [];
    for (const slot of slots) {
      const trimmed = slot.rawScoreInput.trim();
      if (trimmed === '') {
        setError('全プレイヤーの素点を入力してください。');
        return;
      }
      const value = Number(trimmed);
      if (!Number.isFinite(value) || !Number.isInteger(value)) {
        setError('素点は整数で入力してください（例: 25000 / -3500）。');
        return;
      }
      rawScores.push(value);
    }

    // Sum invariant — same rule the server re-checks via `assertRawScoreSum`.
    const expectedSum = selectedRuleset.startingScore * expectedPlayerCount;
    const actualSum = rawScores.reduce((acc, v) => acc + v, 0);
    if (actualSum !== expectedSum) {
      setError(
        `素点の合計が一致しません。期待値 ${expectedSum.toLocaleString()} / 入力値 ${actualSum.toLocaleString()}。`,
      );
      return;
    }

    // Tie check — issue acceptance criteria.
    const uniqueScores = new Set(rawScores);
    if (uniqueScores.size !== rawScores.length) {
      setError('同点（同じ素点）が含まれています。素点を見直してください。');
      return;
    }

    // Tobi role guard: if tobiEnabled is false but a role is set, clear it
    // silently so stale state from a previous Ruleset doesn't leak.
    const tobiEnabled = selectedRuleset.tobiEnabled;
    const tobiRoles = slots.map((s) => (tobiEnabled ? s.tobiRole : null));

    // When tobiEnabled, INFLICTOR ⇔ VICTIM must be paired (the calculator
    // doesn't reject lone roles but the spec is symmetric: somebody inflicts
    // = somebody falls). Keep the guard friendly.
    if (tobiEnabled) {
      const inflictors = tobiRoles.filter((r) => r === 'INFLICTOR').length;
      const victims = tobiRoles.filter((r) => r === 'VICTIM').length;
      if (inflictors !== victims) {
        setError('飛び賞は「飛ばした人」と「飛んだ人」を同じ人数だけ選んでください。');
        return;
      }
    }

    const players: GameSubmitPlayer[] = slots.map((slot, i) => ({
      playerId: slot.playerId,
      rawScore: rawScores[i],
      tobiRole: tobiRoles[i],
    }));

    setSubmitting(true);
    try {
      await onSubmit({
        matchId,
        gameId: initialGame?.id ?? null,
        rulesetId,
        playedAt: playedAt === '' ? null : new Date(`${playedAt}T00:00:00.000Z`).toISOString(),
        players,
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : '保存中にエラーが発生しました。時間をおいて再度お試しください。',
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Expose the live sum so the user has feedback before pressing 「保存」.
  const liveSum = useMemo(() => {
    let total = 0;
    for (const slot of slots) {
      const v = Number(slot.rawScoreInput);
      if (Number.isFinite(v)) total += v;
    }
    return total;
  }, [slots]);

  const expectedSum =
    selectedRuleset === null ? null : selectedRuleset.startingScore * expectedPlayerCount;

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} testId="game-form-modal">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <h2 id={titleId} className="text-base font-semibold text-zinc-100">
            {initialGame === null ? '対局を追加' : '対局を編集'}
          </h2>
          <p className="text-xs text-zinc-500">
            素点合計は {expectedSum?.toLocaleString() ?? '—'} です。差分があると保存できません。
          </p>
        </div>

        {availablePlayers.length < expectedPlayerCount ? (
          <p
            data-testid="game-form-not-enough-players"
            className="rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-100"
          >
            アクティブなプレイヤーが {expectedPlayerCount}{' '}
            人に達していません。プレイヤー管理から追加してください。
          </p>
        ) : null}

        <div className="space-y-2">
          <label htmlFor={rulesetFieldId} className="block text-xs font-medium text-zinc-300">
            適用 Ruleset
          </label>
          <select
            id={rulesetFieldId}
            value={rulesetId}
            onChange={(e) => setRulesetId(e.target.value)}
            data-testid="game-form-ruleset-input"
            className="block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
          >
            {availableRulesets.length === 0 ? (
              <option value="">利用できる Ruleset がありません</option>
            ) : null}
            {availableRulesets.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.isMatchDefault
                  ? '（マッチの既定）'
                  : r.isGroupDefault
                    ? '（グループの既定）'
                    : ''}
              </option>
            ))}
          </select>
          {selectedRuleset !== null ? (
            <p className="text-[11px] text-zinc-500">
              持ち点 {selectedRuleset.startingScore.toLocaleString()} / 返し点{' '}
              {selectedRuleset.returnScore.toLocaleString()} / ウマ {selectedRuleset.umaPattern}
              {selectedRuleset.tobiEnabled
                ? ` / 飛び賞 ${selectedRuleset.tobiPoint ?? 0}`
                : ' / 飛び賞なし'}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor={playedAtFieldId} className="block text-xs font-medium text-zinc-300">
            実施日
          </label>
          <input
            id={playedAtFieldId}
            type="date"
            value={playedAt}
            onChange={(e) => setPlayedAt(e.target.value)}
            data-testid="game-form-played-at-input"
            className="block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-300">プレイヤーと素点</p>
          <ul className="space-y-2" data-testid="game-form-player-slots">
            {slots.map((slot, index) => (
              <PlayerSlotRow
                // biome-ignore lint/suspicious/noArrayIndexKey: slot order is the identity here
                key={index}
                index={index}
                slot={slot}
                availablePlayers={availablePlayers}
                selectedPlayerIdsExcludingSelf={slots
                  .map((s, i) => (i === index ? null : s.playerId))
                  .filter((v): v is string => v !== null && v !== '')}
                showTobi={selectedRuleset?.tobiEnabled === true}
                onChange={(patch) => updateSlot(index, patch)}
              />
            ))}
          </ul>
          <p
            data-testid="game-form-live-sum"
            className={
              expectedSum !== null && liveSum !== expectedSum
                ? 'text-[11px] font-semibold text-amber-300'
                : 'text-[11px] text-zinc-500'
            }
          >
            合計: {liveSum.toLocaleString()}
            {expectedSum !== null ? ` / 期待値 ${expectedSum.toLocaleString()}` : ''}
          </p>
        </div>

        {error !== null ? (
          <p
            role="alert"
            data-testid="game-form-error"
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
            disabled={isSubmitting || selectedRuleset === null}
            data-testid="game-form-submit"
            className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? '保存中…' : '保存'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PlayerSlotRow({
  index,
  slot,
  availablePlayers,
  selectedPlayerIdsExcludingSelf,
  showTobi,
  onChange,
}: {
  index: number;
  slot: PlayerSlot;
  availablePlayers: ReadonlyArray<MatchPlayerOption>;
  selectedPlayerIdsExcludingSelf: ReadonlyArray<string>;
  showTobi: boolean;
  onChange: (patch: Partial<PlayerSlot>) => void;
}) {
  const playerFieldId = useId();
  const scoreFieldId = useId();
  return (
    <li
      data-testid={`game-form-player-slot-${index}`}
      className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3"
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-semibold text-zinc-300">
          {index + 1}
        </span>
        <div className="flex-1 space-y-1">
          <label
            htmlFor={playerFieldId}
            className="block text-[11px] uppercase tracking-[0.15em] text-zinc-500"
          >
            プレイヤー
          </label>
          <select
            id={playerFieldId}
            value={slot.playerId}
            onChange={(e) => onChange({ playerId: e.target.value })}
            data-testid={`game-form-player-input-${index}`}
            className="block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
          >
            <option value="">選択してください</option>
            {availablePlayers.map((p) => {
              const isTaken =
                selectedPlayerIdsExcludingSelf.includes(p.id) && p.id !== slot.playerId;
              return (
                <option key={p.id} value={p.id} disabled={isTaken}>
                  {p.name}
                  {isTaken ? '（選択済み）' : ''}
                </option>
              );
            })}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 space-y-1">
          <label
            htmlFor={scoreFieldId}
            className="block text-[11px] uppercase tracking-[0.15em] text-zinc-500"
          >
            素点
          </label>
          <input
            id={scoreFieldId}
            type="number"
            inputMode="numeric"
            step={100}
            value={slot.rawScoreInput}
            onChange={(e) => onChange({ rawScoreInput: e.target.value })}
            data-testid={`game-form-score-input-${index}`}
            className="block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
            placeholder="例: 25000"
          />
        </div>
        {showTobi ? (
          <div className="w-28 space-y-1">
            <span className="block text-[11px] uppercase tracking-[0.15em] text-zinc-500">
              飛び
            </span>
            <select
              value={slot.tobiRole ?? ''}
              onChange={(e) =>
                onChange({ tobiRole: e.target.value === '' ? null : (e.target.value as TobiRole) })
              }
              data-testid={`game-form-tobi-input-${index}`}
              className="block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
            >
              <option value="">—</option>
              <option value="INFLICTOR">飛ばした</option>
              <option value="VICTIM">飛んだ</option>
            </select>
          </div>
        ) : null}
      </div>
    </li>
  );
}
