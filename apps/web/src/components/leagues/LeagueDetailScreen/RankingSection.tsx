import type { LeagueRankingRow } from '../types';

export const RankingSection = ({ ranking }: { ranking: ReadonlyArray<LeagueRankingRow> }) => {
  return (
    <section className="space-y-3" data-testid="league-detail-ranking-section">
      <h2 className="text-sm font-semibold text-zinc-200">順位表</h2>
      {ranking.length === 0 ? (
        <p
          data-testid="league-detail-ranking-empty"
          className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-5 text-center text-xs text-zinc-400"
        >
          対局結果がまだ登録されていません。対局を追加すると順位表が表示されます。
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900/80 text-[11px] uppercase tracking-[0.15em] text-zinc-500">
              <tr>
                <th scope="col" className="px-3 py-2">
                  順位
                </th>
                <th scope="col" className="px-3 py-2">
                  プレイヤー
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  対局
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  合計
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  平均
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900 text-zinc-200">
              {ranking.map((row, index) => (
                <tr key={row.playerId} data-testid={`league-detail-ranking-row-${row.playerId}`}>
                  <td className="px-3 py-2 font-mono text-[11px] text-zinc-500">{index + 1}</td>
                  <td className="px-3 py-2">{row.playerName}</td>
                  <td className="px-3 py-2 text-right">{row.gameCount}</td>
                  <td className="px-3 py-2 text-right">
                    {row.totalPoints.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {row.averagePoints.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
