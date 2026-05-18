import { Link } from '@tanstack/react-router';
import type { DashboardActiveLeague } from '../types';
import { DashboardSection } from './DashboardSection';
import { EmptyState } from './EmptyState';
import { formatDate } from './formatDate';

export const ActiveLeaguesSection = ({
  leagues,
}: {
  leagues: ReadonlyArray<DashboardActiveLeague>;
}) => {
  return (
    <DashboardSection
      title="アクティブなリーグ"
      moreLabel="リーグを開く"
      moreTo="/leagues"
      testId="dashboard-leagues-section"
    >
      {leagues.length === 0 ? (
        <EmptyState
          testId="dashboard-leagues-empty"
          message="アクティブなリーグはまだありません。"
          ctaLabel="リーグへ移動"
          ctaTo="/leagues"
        />
      ) : (
        <ul className="space-y-2" data-testid="dashboard-leagues-list">
          {leagues.map((league) => (
            <li key={league.id} data-testid={`dashboard-league-row-${league.id}`}>
              <Link
                to="/leagues"
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-emerald-500/70"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-100">{league.name}</p>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {league.groupName} / マッチ {league.matchCount} 件 / 対局 {league.gameCount} 件
                  </p>
                </div>
                <span className="shrink-0 text-xs text-zinc-500">
                  {league.lastPlayedAt === null ? '未対局' : formatDate(league.lastPlayedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
};
