/**
 * P4 個人成績ページ (`04-screens.md` § P4, Issue #23).
 *
 * Surfaces the four sections from Issue #23:
 *   - プレイヤー名 + 所属 League への戻り導線
 *   - League 内集計指標 (対局数 / 合計ポイント / 平均ポイント / 1 位率 /
 *     平均着順 / ラス回数)
 *   - Match 別の成績テーブル (各 Match → P2 へリンク)
 *   - 対局履歴 (League 内、最新順)
 *
 * モバイル 375pt 基準。
 */

import { Link } from '@tanstack/react-router';
import type { TobiRole } from '../../db/schema';
import type {
  PublicPlayerData,
  PublicPlayerGameRow,
  PublicPlayerMatchRow,
  PublicPlayerSummary,
} from './types';

export interface PublicPlayerScreenProps {
  data: PublicPlayerData;
}

const TOBI_LABEL: Readonly<Record<TobiRole, string>> = {
  INFLICTOR: '飛ばした',
  VICTIM: '飛んだ',
};

export function PublicPlayerScreen({ data }: PublicPlayerScreenProps) {
  return (
    <section className="space-y-6" data-testid="public-player-screen">
      <PublicPlayerHeader data={data} />
      <PublicPlayerSummarySection summary={data.summary} />
      <PublicPlayerMatchesSection matches={data.matches} publicSlug={data.leaguePublicSlug} />
      <PublicPlayerGamesSection games={data.games} publicSlug={data.leaguePublicSlug} />
    </section>
  );
}

function PublicPlayerHeader({ data }: { data: PublicPlayerData }) {
  return (
    <header className="space-y-2" data-testid="public-player-header">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Player</p>
      <h1 className="text-2xl font-bold text-zinc-50">{data.playerName}</h1>
      <p className="text-sm text-zinc-400">
        <Link
          to="/l/$publicSlug"
          params={{ publicSlug: data.leaguePublicSlug }}
          className="text-emerald-300 underline-offset-2 hover:underline"
        >
          {data.leagueName}
        </Link>
      </p>
    </header>
  );
}

function PublicPlayerSummarySection({ summary }: { summary: PublicPlayerSummary }) {
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
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">{label}</dt>
      <dd className="mt-1 font-mono text-sm text-zinc-100">{value}</dd>
    </div>
  );
}

function PublicPlayerMatchesSection({
  matches,
  publicSlug,
}: {
  matches: ReadonlyArray<PublicPlayerMatchRow>;
  publicSlug: string;
}) {
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
}

function PublicPlayerGamesSection({
  games,
  publicSlug,
}: {
  games: ReadonlyArray<PublicPlayerGameRow>;
  publicSlug: string;
}) {
  return (
    <section className="space-y-3" data-testid="public-player-games-section">
      <h2 className="text-sm font-semibold text-zinc-200">対局履歴</h2>
      {games.length === 0 ? (
        <p
          data-testid="public-player-games-empty"
          className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-5 text-center text-xs text-zinc-400"
        >
          このプレイヤーの対局はまだありません。
        </p>
      ) : (
        <ul className="space-y-2" data-testid="public-player-games-list">
          {games.map((game) => (
            <li
              key={game.gameId}
              data-testid={`public-player-game-row-${game.gameId}`}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <Link
                  to="/l/$publicSlug/matches/$sequenceNumber"
                  params={{ publicSlug, sequenceNumber: String(game.matchSequenceNumber) }}
                  className="truncate text-emerald-300 underline-offset-2 hover:underline"
                >
                  第 {game.matchSequenceNumber} 節 {game.matchName}
                </Link>
                <time className="shrink-0 text-zinc-500" dateTime={game.playedAt}>
                  {formatDate(game.playedAt)}
                </time>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-zinc-200">
                <span className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-300">
                    {game.rank}
                  </span>
                  {game.tobiRole !== null ? (
                    <span className="rounded-full bg-amber-900/40 px-2 py-0.5 text-[10px] text-amber-200">
                      {TOBI_LABEL[game.tobiRole]}
                    </span>
                  ) : null}
                </span>
                <span className="font-mono text-zinc-400">
                  {game.rawScore.toLocaleString()}
                  <span className="ml-2 text-emerald-300">{formatPointsSigned(game.points)}</span>
                </span>
              </div>
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

function formatPointsSigned(value: number): string {
  const formatted = value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return value > 0 ? `+${formatted}` : formatted;
}

function formatRate(value: number): string {
  return `${(value * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}
