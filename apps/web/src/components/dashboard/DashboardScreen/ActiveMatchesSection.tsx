import { Link } from '@tanstack/react-router';
import type { DashboardActiveMatch } from '../types';
import { DashboardSection } from './DashboardSection';
import { EmptyState } from './EmptyState';
import { formatDate } from './formatDate';

export const ActiveMatchesSection = ({
  matches,
}: {
  matches: ReadonlyArray<DashboardActiveMatch>;
}) => {
  return (
    <DashboardSection
      title="アクティブなマッチ"
      moreLabel="マッチを開く"
      moreTo="/matches"
      testId="dashboard-matches-section"
    >
      {matches.length === 0 ? (
        <EmptyState
          testId="dashboard-matches-empty"
          message="アクティブなマッチはまだありません。"
          ctaLabel="マッチへ移動"
          ctaTo="/matches"
        />
      ) : (
        <ul className="space-y-2" data-testid="dashboard-matches-list">
          {matches.map((match) => (
            <li key={match.id} data-testid={`dashboard-match-row-${match.id}`}>
              <Link
                to="/matches"
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-emerald-500/70"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-100">{match.name}</p>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {match.groupName}
                    {match.leagueName === null ? '' : ` / ${match.leagueName}`} / 対局{' '}
                    {match.gameCount} 件
                  </p>
                </div>
                <span className="shrink-0 text-xs text-zinc-500">
                  {match.heldAt === null ? '未開催' : formatDate(match.heldAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
};
