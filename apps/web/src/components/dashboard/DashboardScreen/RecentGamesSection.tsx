import type { DashboardRecentGame } from '../types';
import { DashboardSection } from './DashboardSection';
import { EmptyState } from './EmptyState';
import { formatDate } from './formatDate';

export const RecentGamesSection = ({ games }: { games: ReadonlyArray<DashboardRecentGame> }) => {
  return (
    <DashboardSection
      title="直近の対局"
      moreLabel="マッチで確認"
      moreTo="/matches"
      testId="dashboard-recent-games-section"
    >
      {games.length === 0 ? (
        <EmptyState
          testId="dashboard-recent-games-empty"
          message="まだ対局がありません。"
          ctaLabel="マッチで対局を追加"
          ctaTo="/matches"
        />
      ) : (
        <ul className="space-y-2" data-testid="dashboard-recent-games-list">
          {games.map((game) => (
            <li
              key={game.id}
              data-testid={`dashboard-recent-game-row-${game.id}`}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-100">
                    {game.matchName ?? 'カジュアル対局'}
                  </p>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {game.groupName}
                    {game.leagueName === null ? '' : ` / ${game.leagueName}`}
                  </p>
                </div>
                <time className="shrink-0 text-xs text-zinc-500" dateTime={game.playedAt}>
                  {formatDate(game.playedAt)}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
};
