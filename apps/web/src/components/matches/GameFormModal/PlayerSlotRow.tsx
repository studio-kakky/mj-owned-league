import { useId } from 'react';
import type { TobiRole } from '../../../db/schema';
import type { MatchPlayerOption } from '../detail-types';

export type PlayerSlot = {
  playerId: string;
  /** Empty string when the user has not filled the field yet. */
  rawScoreInput: string;
  tobiRole: TobiRole | null;
};

export const PlayerSlotRow = ({
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
}) => {
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
};
