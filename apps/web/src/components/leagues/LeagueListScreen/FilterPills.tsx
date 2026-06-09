import type { LeagueListFilter } from '../types';
import { FILTERS } from './filters';

export const FilterPills = ({
  active,
  counts,
  onChange,
}: {
  active: LeagueListFilter;
  /** Per-filter result count shown as a mono suffix on each pill. */
  counts: Readonly<Record<LeagueListFilter, number>>;
  onChange: (next: LeagueListFilter) => void;
}) => {
  return (
    <div
      role="tablist"
      aria-label="リーグの状態で絞り込み"
      data-testid="leagues-filter-pills"
      className="flex gap-1.5 overflow-x-auto px-5 pb-1"
    >
      {FILTERS.map((entry) => {
        const isActive = entry.value === active;
        return (
          <button
            key={entry.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(entry.value)}
            data-testid={`leagues-filter-${entry.value.toLowerCase()}`}
            className={`flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors ${
              isActive
                ? 'border-[#FAFAF8] bg-[#FAFAF8] font-semibold text-[#0E0E0E]'
                : 'border-[#2a2a2a] text-[#888888] hover:text-[#FAFAF8]'
            }`}
          >
            <span>{entry.label}</span>
            <span
              className={`font-mono text-[11px] ${isActive ? 'text-[#0E0E0E] opacity-70' : 'text-[#666666]'}`}
            >
              {counts[entry.value]}
            </span>
          </button>
        );
      })}
    </div>
  );
};
