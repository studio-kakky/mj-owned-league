import { Link } from '@tanstack/react-router';
import type { LeagueMatchRow } from '../types';
import { formatDate } from './formatDate';

export const MatchesSection = ({
  matches,
  groupId,
  leagueId,
}: {
  matches: ReadonlyArray<LeagueMatchRow>;
  groupId: string;
  leagueId: string;
}) => {
  return (
    <section className="space-y-3" data-testid="league-detail-matches-section">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-200">マッチ</h2>
        <div className="flex items-center gap-2">
          <Link
            to="/groups/$groupId/matches"
            params={{ groupId }}
            search={{ leagueId }}
            data-testid="league-detail-match-list-link"
            className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 transition-colors hover:border-emerald-500/70"
          >
            一覧
          </Link>
          <Link
            to="/groups/$groupId/matches/new"
            params={{ groupId }}
            search={{ leagueId }}
            data-testid="league-detail-match-create-link"
            className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
          >
            追加
          </Link>
        </div>
      </div>
      {matches.length === 0 ? (
        <p
          data-testid="league-detail-matches-empty"
          className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-5 text-center text-xs text-zinc-400"
        >
          このリーグにはまだマッチがありません。
        </p>
      ) : (
        <ul className="space-y-2" data-testid="league-detail-matches-list">
          {matches.map((match) => (
            <li key={match.id} data-testid={`league-detail-match-row-${match.id}`}>
              <Link
                to="/groups/$groupId/matches/$matchId"
                params={{ groupId, matchId: match.id }}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 transition-colors hover:border-emerald-500/70"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-100">
                    {match.sequenceNumber !== null ? `第 ${match.sequenceNumber} 節 ` : ''}
                    {match.name}
                  </p>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    対局 {match.gameCount} 件
                    {match.heldAt === null ? '' : ` / ${formatDate(match.heldAt)}`}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
