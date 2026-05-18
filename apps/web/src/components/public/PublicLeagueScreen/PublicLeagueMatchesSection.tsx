import { Link } from '@tanstack/react-router';
import type { PublicLeagueMatchRow } from '../types';

const formatDate = (iso: string): string => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
};

export const PublicLeagueMatchesSection = ({
  matches,
  publicSlug,
}: {
  matches: ReadonlyArray<PublicLeagueMatchRow>;
  publicSlug: string;
}) => {
  return (
    <section className="space-y-3" data-testid="public-league-matches-section">
      <h2 className="text-sm font-semibold text-zinc-200">マッチ</h2>
      {matches.length === 0 ? (
        <p
          data-testid="public-league-matches-empty"
          className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-5 text-center text-xs text-zinc-400"
        >
          このリーグにはまだマッチがありません。
        </p>
      ) : (
        <ul className="space-y-2" data-testid="public-league-matches-list">
          {matches.map((match) => (
            <li key={match.id} data-testid={`public-league-match-row-${match.id}`}>
              <Link
                to="/l/$publicSlug/matches/$sequenceNumber"
                params={{ publicSlug, sequenceNumber: String(match.sequenceNumber) }}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 transition-colors hover:border-emerald-500/70"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-100">
                    第 {match.sequenceNumber} 節 {match.name}
                  </p>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    対局 {match.gameCount} 件
                    {match.heldAt === null ? '' : ` / ${formatDate(match.heldAt)}`}
                  </p>
                </div>
                <span aria-hidden="true" className="text-zinc-500">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
