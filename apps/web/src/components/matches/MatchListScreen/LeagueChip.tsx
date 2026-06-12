import { Link } from '@tanstack/react-router';

interface LeagueChipProps {
  /** The Group the chip's list link is scoped to. */
  groupId: string;
  label: string;
  active: boolean;
  /** When omitted, the chip links to the Group's list with no search (= すべて). */
  searchLeagueId?: string;
  testId: string;
}

export const LeagueChip = ({ groupId, label, active, searchLeagueId, testId }: LeagueChipProps) => {
  const search = searchLeagueId !== undefined ? { leagueId: searchLeagueId } : {};
  return (
    <Link
      to="/groups/$groupId/matches"
      params={{ groupId }}
      search={search}
      data-testid={testId}
      aria-pressed={active}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors ${
        active
          ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200'
          : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100'
      }`}
    >
      <span>{label}</span>
    </Link>
  );
};
