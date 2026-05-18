import type { TobiRole } from '../../../db/schema';
import type { PublicMatchGameResultRow } from '../types';

const TOBI_LABEL: Readonly<Record<TobiRole, string>> = {
  INFLICTOR: '飛ばした',
  VICTIM: '飛んだ',
};

const formatPointsSigned = (value: number): string => {
  const formatted = value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return value > 0 ? `+${formatted}` : formatted;
};

export const PublicGameResultLine = ({ result }: { result: PublicMatchGameResultRow }) => {
  return (
    <li className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
      <span className="flex items-center gap-2 truncate text-zinc-100">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-300">
          {result.rank}
        </span>
        <span className="truncate">{result.playerName}</span>
        {result.tobiRole !== null ? (
          <span className="rounded-full bg-amber-900/40 px-2 py-0.5 text-[10px] text-amber-200">
            {TOBI_LABEL[result.tobiRole]}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 font-mono text-zinc-400">
        {result.rawScore.toLocaleString()}
        <span className="ml-2 text-emerald-300">{formatPointsSigned(result.points)}</span>
      </span>
    </li>
  );
};
