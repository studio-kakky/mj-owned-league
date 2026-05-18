import { Link } from '@tanstack/react-router';
import type { GroupHomeMatchRow } from '../types';
import { EmptyState } from './EmptyState';
import { formatDate } from './formatDate';
import { GroupHomeSection } from './GroupHomeSection';

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
        <ul className="space-y-2" data-testid="group-home-matches-list">
          {matches.map((match) => (
            <li key={match.id} data-testid={`group-home-match-row-${match.id}`}>
              <Link
                to="/matches/$matchId"
                params={{ matchId: match.id }}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 transition-colors hover:border-emerald-500/70"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-100">
                    {match.sequenceNumber !== null ? `第 ${match.sequenceNumber} 節 ` : ''}
                    {match.name}
                  </p>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {match.leagueName === null ? 'League 外' : match.leagueName} / 対局{' '}
                    {match.gameCount} 件
                  </p>
                </div>
                <span className="shrink-0 text-xs text-zinc-500">
                  {match.heldAt === null ? '日付未設定' : formatDate(match.heldAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </GroupHomeSection>
  );
};
