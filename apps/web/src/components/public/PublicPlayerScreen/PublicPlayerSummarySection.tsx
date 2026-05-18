import type { PublicPlayerSummary } from '../types';
import { SummaryCell } from './SummaryCell';

const formatRate = (value: number): string => {
  return `${(value * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
};

export const PublicPlayerSummarySection = ({ summary }: { summary: PublicPlayerSummary }) => {
  return (
    <section className="space-y-3" data-testid="public-player-summary-section">
      <h2 className="text-sm font-semibold text-zinc-200">集計指標</h2>
      <dl className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs">
        <SummaryCell label="対局数" value={summary.gameCount.toString()} />
        <SummaryCell
          label="合計ポイント"
          value={summary.totalPoints.toLocaleString(undefined, { maximumFractionDigits: 1 })}
        />
        <SummaryCell
          label="平均ポイント"
          value={summary.averagePoints.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        />
        <SummaryCell label="1 位率" value={formatRate(summary.topRate)} />
        <SummaryCell
          label="平均着順"
          value={summary.averageRank.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        />
        <SummaryCell label="ラス回数" value={summary.lastCount.toString()} />
      </dl>
    </section>
  );
};
