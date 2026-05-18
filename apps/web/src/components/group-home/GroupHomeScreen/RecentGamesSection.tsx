import type { GroupHomeRecentGameRow } from '../types';
import { formatDate } from './formatDate';
import { GroupHomeSection } from './GroupHomeSection';

export const RecentGamesSection = ({
  games,
}: {
  games: ReadonlyArray<GroupHomeRecentGameRow>;
}) => {
  return (
    <GroupHomeSection
      title="直近の対局"
      moreLabel="マッチで確認"
      moreTo="/matches"
      moreSearch={undefined}
      testId="group-home-recent-games-section"
    >
      {games.length === 0 ? (
        <p
          data-testid="group-home-recent-games-empty"
          className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-5 text-center text-xs text-zinc-400"
        >
          まだ対局がありません。
        </p>
      ) : (
        <ul className="space-y-2" data-testid="group-home-recent-games-list">
          {games.map((game) => (
            <li
              key={game.id}
              data-testid={`group-home-recent-game-row-${game.id}`}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-100">
                    {game.matchName ?? 'カジュアル対局'}
                  </p>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {game.leagueName === null ? 'League 外' : game.leagueName}
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
    </GroupHomeSection>
  );
};
