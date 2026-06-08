import type { GroupHomeRankingRow } from '../types';

/** `+428.3` / `−42.0` — explicit sign, one decimal, U+2212 for negatives. */
const formatPoints = (n: number): string => {
  const sign = n < 0 ? '−' : '+';
  const abs = Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${sign}${abs}`;
};

export const RankingSection = ({ ranking }: { ranking: ReadonlyArray<GroupHomeRankingRow> }) => {
  return (
    <section className="mt-7" data-testid="group-home-ranking-section">
      <div className="mb-2.5 flex items-baseline gap-2.5 px-5">
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[#888888]">
          ランキング
        </span>
        {ranking.length > 0 ? (
          <span className="font-mono text-[11px] text-[#666666]">通算</span>
        ) : null}
      </div>

      {ranking.length === 0 ? (
        <p
          data-testid="group-home-ranking-empty"
          className="mx-5 rounded-lg border border-dashed border-[#262626] p-5 text-center text-xs text-[#888888]"
        >
          対局結果がまだ登録されていません。対局を追加するとランキングが表示されます。
        </p>
      ) : (
        <div>
          {ranking.map((row, index) => {
            const rank = index + 1;
            const isTop3 = rank <= 3;
            const isNegative = row.totalPoints < 0;
            return (
              <div
                key={row.playerId}
                data-testid={`group-home-ranking-row-${row.playerId}`}
                className="flex items-center gap-3.5 border-t border-[#1F1F1F] px-5 py-3.5 [&:last-child]:border-b"
              >
                <span
                  className={`w-[22px] shrink-0 text-right font-mono text-[13px] ${
                    isTop3 ? 'font-semibold text-[#FAFAF8]' : 'text-[#666666]'
                  }`}
                >
                  {rank}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-[#FAFAF8]">
                    {row.playerName}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-[#666666]">
                    <span>{row.gameCount} 局</span>
                    <span>·</span>
                    <span>1着 {row.topCount}</span>
                  </div>
                </div>
                <span
                  className={`shrink-0 font-mono text-sm font-medium ${
                    isNegative ? 'text-[#c87878]' : 'text-[#FAFAF8]'
                  }`}
                >
                  {formatPoints(row.totalPoints)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
