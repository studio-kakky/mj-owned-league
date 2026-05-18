import { Link } from '@tanstack/react-router';

interface LeagueChipProps {
  label: string;
  /** Optional second-line clarifier (Group name) when names collide. */
  sublabel?: string | null;
  active: boolean;
  href: '/matches';
  /** When omitted, the chip links to `/matches` with no search (= すべて). */
  searchLeagueId?: string;
  testId: string;
}

export const LeagueChip = ({
  label,
  sublabel,
  active,
  href,
  searchLeagueId,
  testId,
}: LeagueChipProps) => {
  const search = searchLeagueId !== undefined ? { leagueId: searchLeagueId } : {};
  return (
    <Link
      to={href}
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
      {sublabel ? <span className="text-[10px] text-zinc-500">/ {sublabel}</span> : null}
    </Link>
  );
};
