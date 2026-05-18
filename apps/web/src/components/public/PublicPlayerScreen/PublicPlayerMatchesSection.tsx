import { Link } from '@tanstack/react-router';
import type { PublicPlayerMatchRow } from '../types';

const formatDate = (iso: string): string => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
};

export const PublicPlayerMatchesSection = ({
  matches,
  publicSlug,
}: {
  matches: ReadonlyArray<PublicPlayerMatchRow>;
  publicSlug: string;
}) => {
  return (
    <section className="space-y-3" data-testid="public-player-matches-section">
      <h2 className="text-sm font-semibold text-zinc-200">Match 別成績</h2>
      {matches.length === 0 ? (
        <p
          data-testid="public-player-matches-empty"
          className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-5 text-center text-xs text-zinc-400"
        >
          このリーグにはまだマッチがありません。
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900/80 text-[11px] uppercase tracking-[0.15em] text-zinc-500">
              <tr>
                <th scope="col" className="px-3 py-2">
                  Match
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
                <th scope="col" className="px-3 py-2 text-right">
                  トップ
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  ラス
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900 text-zinc-200">
              {matches.map((row) => (
                <tr key={row.matchId} data-testid={`public-player-match-row-${row.matchId}`}>
                  <td className="px-3 py-2">
                    <Link
                      to="/l/$publicSlug/matches/$sequenceNumber"
                      params={{ publicSlug, sequenceNumber: String(row.sequenceNumber) }}
                      className="text-emerald-300 underline-offset-2 hover:underline"
                    >
                      第 {row.sequenceNumber} 節 {row.matchName}
                    </Link>
                    {row.heldAt === null ? null : (
                      <span className="block text-[10px] text-zinc-500">
                        {formatDate(row.heldAt)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{row.gameCount}</td>
                  <td className="px-3 py-2 text-right">
                    {row.totalPoints.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {row.averagePoints.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-right">{row.topCount}</td>
                  <td className="px-3 py-2 text-right">{row.lastCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
