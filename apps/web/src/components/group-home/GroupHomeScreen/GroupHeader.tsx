import type { GroupHomeData } from '../types';
import { formatDate } from './formatDate';
import { SummaryPill } from './SummaryPill';

export const GroupHeader = ({ data }: { data: GroupHomeData }) => {
  return (
    <header className="px-5 pt-5" data-testid="group-home-header">
      <div className="min-w-0">
        <h1 className="truncate text-[22px] font-semibold tracking-[-0.01em] text-[#FAFAF8]">
          {data.name}
        </h1>
        <p className="mt-1 font-mono text-[11px] text-[#666666]">作成 {formatDate(data.createdAt)}</p>
      </div>
      <dl
        data-testid="group-home-summary"
        className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-[#1F1F1F] bg-[#1F1F1F] text-center"
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
