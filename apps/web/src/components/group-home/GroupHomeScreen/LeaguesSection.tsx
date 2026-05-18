import { Link } from '@tanstack/react-router';
import type { GroupHomeLeagueRow } from '../types';
import { EmptyState } from './EmptyState';
import { formatDate } from './formatDate';
import { GroupHomeSection } from './GroupHomeSection';

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
        <ul className="space-y-2" data-testid="group-home-leagues-list">
          {leagues.map((league) => (
            <li key={league.id} data-testid={`group-home-league-row-${league.id}`}>
              <Link
                to="/leagues/$leagueId"
                params={{ leagueId: league.id }}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 transition-colors hover:border-emerald-500/70"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-100">{league.name}</p>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    マッチ {league.matchCount} 件 / 対局 {league.gameCount} 件
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
    </GroupHomeSection>
  );
};
