/**
 * P1 League 公開ページ (`04-screens.md` § P1, Issue #23).
 *
 * Surfaces the four sections called out in `03-user-flow.md` § F8:
 *   - League 概要 (名前 / 形式 / 適用 Ruleset)
 *   - 順位表 (順位 / 対局数 / 合計 / 平均 / 1 位率 / 平均着順)
 *   - Match 一覧 (各 Match → P2 へリンク)
 *   - 個人成績への動線 (各プレイヤー名 → P4 へリンク)
 *
 * モバイル 375pt 基準。`sm:` 以上のブレークポイントは未使用。
 *
 * The screen is purely presentational; no editing affordance and no fetcher
 * — the route loader feeds it data from the public server function. This
 * mirrors the Owner-side `LeagueDetailScreen` so the two surfaces look like
 * obvious siblings, with the public one stripping the public-URL copy bar
 * (the viewer is *already* on that URL) and any "追加 / 編集" button.
 */

import { Link } from '@tanstack/react-router';
import type { LeagueFormat } from '../../db/schema';
import type {
  PublicLeagueData,
  PublicLeagueMatchRow,
  PublicLeagueRankingRow,
  PublicRulesetSummary,
} from './types';

export interface PublicLeagueScreenProps {
  data: PublicLeagueData;
}

const FORMAT_LABELS: Readonly<Record<LeagueFormat, string>> = {
  '4P_HANCHAN': '4人 半荘',
  '4P_TONPU': '4人 東風',
  '3P_HANCHAN': '3人 半荘',
  '3P_TONPU': '3人 東風',
};

export function PublicLeagueScreen({ data }: PublicLeagueScreenProps) {
  return (
    <section className="space-y-6" data-testid="public-league-screen">
      <PublicLeagueHeader data={data} />
      <PublicRulesetCallout ruleset={data.defaultRuleset} />
      <PublicLeagueRankingSection ranking={data.ranking} publicSlug={data.publicSlug} />
      <PublicLeagueMatchesSection matches={data.matches} publicSlug={data.publicSlug} />
    </section>
  );
}

function PublicLeagueHeader({ data }: { data: PublicLeagueData }) {
  return (
    <header className="space-y-2" data-testid="public-league-header">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">League</p>
      <h1 className="text-2xl font-bold text-zinc-50">{data.name}</h1>
      <p className="text-sm text-zinc-400">
        {data.groupName} / {FORMAT_LABELS[data.format]}
      </p>
    </header>
  );
}

function PublicRulesetCallout({ ruleset }: { ruleset: PublicRulesetSummary | null }) {
  if (ruleset === null) {
    return (
      <section
        data-testid="public-league-ruleset-empty"
        className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-4 text-xs text-zinc-400"
      >
        既定の Ruleset は未設定です。
      </section>
    );
  }
  return (
    <section
      data-testid="public-league-ruleset"
      className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
    >
      <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">適用 Ruleset</p>
      <p className="text-sm font-semibold text-zinc-100">{ruleset.name}</p>
      <p className="text-xs text-zinc-500">
        持ち点 {ruleset.startingScore.toLocaleString()} / 返し点{' '}
        {ruleset.returnScore.toLocaleString()} / ウマ {ruleset.umaPattern}
        {ruleset.tobiPoint === null ? ' / 飛び賞なし' : ` / 飛び賞 ${ruleset.tobiPoint}`}
      </p>
    </section>
  );
}

function PublicLeagueRankingSection({
  ranking,
  publicSlug,
}: {
  ranking: ReadonlyArray<PublicLeagueRankingRow>;
  publicSlug: string;
}) {
  return (
    <section className="space-y-3" data-testid="public-league-ranking-section">
      <h2 className="text-sm font-semibold text-zinc-200">順位表</h2>
      {ranking.length === 0 ? (
        <p
          data-testid="public-league-ranking-empty"
          className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-5 text-center text-xs text-zinc-400"
        >
          対局結果がまだ登録されていません。
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
                <th scope="col" className="px-3 py-2 text-right">
                  1 位率
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  平均着順
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900 text-zinc-200">
              {ranking.map((row, index) => (
                <tr key={row.playerId} data-testid={`public-league-ranking-row-${row.playerId}`}>
                  <td className="px-3 py-2 font-mono text-[11px] text-zinc-500">{index + 1}</td>
                  <td className="px-3 py-2">
                    <Link
                      to="/l/$publicSlug/players/$playerId"
                      params={{ publicSlug, playerId: row.playerId }}
                      data-testid={`public-league-ranking-player-link-${row.playerId}`}
                      className="text-emerald-300 underline-offset-2 hover:underline"
                    >
                      {row.playerName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right">{row.gameCount}</td>
                  <td className="px-3 py-2 text-right">
                    {row.totalPoints.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {row.averagePoints.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-right">{formatRate(row.topRate)}</td>
                  <td className="px-3 py-2 text-right">
                    {row.averageRank.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PublicLeagueMatchesSection({
  matches,
  publicSlug,
}: {
  matches: ReadonlyArray<PublicLeagueMatchRow>;
  publicSlug: string;
}) {
  return (
    <section className="space-y-3" data-testid="public-league-matches-section">
      <h2 className="text-sm font-semibold text-zinc-200">マッチ</h2>
      {matches.length === 0 ? (
        <p
          data-testid="public-league-matches-empty"
          className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-5 text-center text-xs text-zinc-400"
        >
          このリーグにはまだマッチがありません。
        </p>
      ) : (
        <ul className="space-y-2" data-testid="public-league-matches-list">
          {matches.map((match) => (
            <li key={match.id} data-testid={`public-league-match-row-${match.id}`}>
              <Link
                to="/l/$publicSlug/matches/$sequenceNumber"
                params={{ publicSlug, sequenceNumber: String(match.sequenceNumber) }}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 transition-colors hover:border-emerald-500/70"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-100">
                    第 {match.sequenceNumber} 節 {match.name}
                  </p>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    対局 {match.gameCount} 件
                    {match.heldAt === null ? '' : ` / ${formatDate(match.heldAt)}`}
                  </p>
                </div>
                <span aria-hidden="true" className="text-zinc-500">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}

function formatRate(value: number): string {
  return `${(value * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}
