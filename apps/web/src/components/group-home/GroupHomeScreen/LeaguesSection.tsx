import { Link } from '@tanstack/react-router';
import type { GroupHomeLeagueRow } from '../types';
import { EmptyState } from './EmptyState';
import { formatDate } from './formatDate';
import { ChevronRight, GroupHomeSection } from './GroupHomeSection';

export const LeaguesSection = ({
  groupId,
  leagues,
}: {
  groupId: string;
  leagues: ReadonlyArray<GroupHomeLeagueRow>;
}) => {
  return (
    <GroupHomeSection
      title="リーグ"
      count={leagues.length > 0 ? String(leagues.length) : undefined}
      moreLabel="リーグを開く"
      moreTo="/leagues"
      moreSearch={{ groupId }}
      testId="group-home-leagues-section"
    >
      {leagues.length === 0 ? (
        <EmptyState
          testId="group-home-leagues-empty"
          message="このグループにはまだリーグがありません。"
          ctaLabel="リーグへ移動"
          ctaTo="/leagues"
          ctaSearch={{ groupId }}
        />
      ) : (
        <ul data-testid="group-home-leagues-list">
          {leagues.map((league) => (
            <li key={league.id} data-testid={`group-home-league-row-${league.id}`}>
              <Link
                to="/leagues/$leagueId"
                params={{ leagueId: league.id }}
                className="flex items-center justify-between gap-3 border-t border-[#1F1F1F] px-5 py-3.5 transition-colors [&:last-child]:border-b hover:bg-[#141414]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-[#FAFAF8]">{league.name}</p>
                  <p className="mt-1 truncate font-mono text-xs text-[#666666]">
                    マッチ {league.matchCount} 件 · 対局 {league.gameCount} 件 · 更新{' '}
                    {league.lastPlayedAt === null ? '未対局' : formatDate(league.lastPlayedAt)}
                  </p>
                </div>
                <ChevronRight className="shrink-0 text-[#888888]" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </GroupHomeSection>
  );
};
