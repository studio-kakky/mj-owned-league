import type { GroupHomeRecentGameRow } from '../types';
import { formatDate } from './formatDate';
import { ChevronRight, GroupHomeSection } from './GroupHomeSection';

export const RecentGamesSection = ({ games }: { games: ReadonlyArray<GroupHomeRecentGameRow> }) => {
  return (
    <GroupHomeSection
      title="対局"
      moreLabel="マッチで確認"
      moreTo="/matches"
      moreSearch={undefined}
      testId="group-home-recent-games-section"
    >
      {games.length === 0 ? (
        <p
          data-testid="group-home-recent-games-empty"
          className="mx-5 rounded-lg border border-dashed border-[#262626] p-5 text-center text-xs text-[#888888]"
        >
          まだ対局がありません。
        </p>
      ) : (
        <ul data-testid="group-home-recent-games-list">
          {games.map((game) => (
            <li
              key={game.id}
              data-testid={`group-home-recent-game-row-${game.id}`}
              className="flex items-center justify-between gap-3 border-t border-[#1F1F1F] px-5 py-3.5 [&:last-child]:border-b"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-[#FAFAF8]">
                  {game.matchName ?? 'カジュアル対局'}
                </p>
                <p className="mt-1 flex items-center gap-1.5 truncate font-mono text-xs text-[#666666]">
                  <span>{game.leagueName === null ? 'League 外' : game.leagueName}</span>
                  <span>·</span>
                  <time dateTime={game.playedAt}>{formatDate(game.playedAt)}</time>
                </p>
              </div>
              <ChevronRight className="shrink-0 text-[#888888]" />
            </li>
          ))}
        </ul>
      )}
    </GroupHomeSection>
  );
};
