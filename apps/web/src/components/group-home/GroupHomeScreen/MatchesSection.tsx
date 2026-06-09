import { Link } from '@tanstack/react-router';
import type { GroupHomeMatchRow } from '../types';
import { EmptyState } from './EmptyState';
import { formatDate } from './formatDate';
import { ChevronRight, GroupHomeSection } from './GroupHomeSection';

export const MatchesSection = ({
  groupId,
  matches,
}: {
  groupId: string;
  matches: ReadonlyArray<GroupHomeMatchRow>;
}) => {
  return (
    <GroupHomeSection
      title="マッチ履歴"
      moreLabel="マッチを開く"
      moreTo="/matches"
      moreSearch={{ groupId }}
      testId="group-home-matches-section"
    >
      {matches.length === 0 ? (
        <EmptyState
          testId="group-home-matches-empty"
          message="このグループにはまだマッチがありません。"
          ctaLabel="マッチへ移動"
          ctaTo="/matches"
          ctaSearch={{ groupId }}
        />
      ) : (
        <ul data-testid="group-home-matches-list">
          {matches.map((match) => (
            <li key={match.id} data-testid={`group-home-match-row-${match.id}`}>
              <Link
                to="/matches/$matchId"
                params={{ matchId: match.id }}
                className="flex items-center justify-between gap-3 border-t border-[#1F1F1F] px-5 py-3.5 transition-colors [&:last-child]:border-b hover:bg-[#141414]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-[#FAFAF8]">
                    {match.sequenceNumber !== null ? `第 ${match.sequenceNumber} 節 ` : ''}
                    {match.name}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 truncate font-mono text-xs text-[#666666]">
                    {match.leagueName === null ? (
                      <span className="text-[#555555]">リーグ外</span>
                    ) : (
                      <span>{match.leagueName}</span>
                    )}
                    <span>·</span>
                    <span>対局 {match.gameCount} 件</span>
                    <span>·</span>
                    <span>{match.heldAt === null ? '日付未設定' : formatDate(match.heldAt)}</span>
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
