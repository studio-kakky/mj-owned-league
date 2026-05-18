import type { LeagueListFilter } from '../types';
import { FILTERS } from './filters';

export const FilterPills = ({
  active,
  onChange,
}: {
  active: LeagueListFilter;
  onChange: (next: LeagueListFilter) => void;
}) => {
  return (
    <div
      role="tablist"
      aria-label="リーグの状態で絞り込み"
      data-testid="leagues-filter-pills"
      className="flex items-center gap-2"
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
            className={
              isActive
                ? 'rounded-full bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-200'
                : 'rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
            }
          >
            {entry.label}
          </button>
        );
      })}
    </div>
  );
};
