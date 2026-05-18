import { Link } from '@tanstack/react-router';
import type { GroupHomeData } from '../types';
import { formatDate } from './formatDate';
import { SummaryPill } from './SummaryPill';

export const GroupHeader = ({ data }: { data: GroupHomeData }) => {
  return (
    <header className="space-y-3" data-testid="group-home-header">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Group</p>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-zinc-50">{data.name}</h1>
          <p className="mt-1 text-xs text-zinc-500">作成 {formatDate(data.createdAt)}</p>
        </div>
        <Link
          to="/groups"
          data-testid="group-home-back-link"
          className="shrink-0 rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 transition-colors hover:border-emerald-500/70"
        >
          一覧へ
        </Link>
      </div>
      <dl
        data-testid="group-home-summary"
        className="grid grid-cols-3 gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-center"
      >
        <SummaryPill
          testId="group-home-summary-players"
          label="プレイヤー"
          value={`${data.activePlayerCount} 人`}
        />
        <SummaryPill
          testId="group-home-summary-games"
          label="対局"
          value={`${data.totalGameCount} 局`}
        />
        <SummaryPill
          testId="group-home-summary-last-played"
          label="最終対局"
          value={data.lastPlayedAt === null ? '未対局' : formatDate(data.lastPlayedAt)}
        />
      </dl>
    </header>
  );
};
