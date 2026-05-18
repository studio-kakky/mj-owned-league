import { Link } from '@tanstack/react-router';
import type { DashboardGroupCard } from '../types';
import { DashboardSection } from './DashboardSection';
import { EmptyState } from './EmptyState';
import { formatDate } from './formatDate';

export const GroupsSection = ({ groups }: { groups: ReadonlyArray<DashboardGroupCard> }) => {
  return (
    <DashboardSection
      title="自分のグループ"
      moreLabel="すべてのグループ"
      moreTo="/groups"
      testId="dashboard-groups-section"
    >
      {groups.length === 0 ? (
        <EmptyState
          testId="dashboard-groups-empty"
          message="グループはまだありません。"
          ctaLabel="グループを作成"
          ctaTo="/groups"
        />
      ) : (
        <ul className="space-y-3" data-testid="dashboard-groups-list">
          {groups.map((group) => (
            <li key={group.id} data-testid={`dashboard-group-card-${group.id}`}>
              <Link
                to="/groups/$groupId"
                params={{ groupId: group.id }}
                className="block rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-emerald-500/70"
              >
                <p className="truncate text-sm font-semibold text-zinc-100">{group.name}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  プレイヤー {group.playerCount} 人 / 最終対局{' '}
                  {group.lastPlayedAt === null ? '未対局' : formatDate(group.lastPlayedAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
};
