/**
 * P2 / P3 Match 公開ページ (`04-screens.md` § P2 / P3, Issue #23).
 *
 * Surfaces three sections (`03-user-flow.md` § F8):
 *   - Match 概要 (名前 / 開催日 / メモ / 適用 Ruleset)
 *   - Match 内順位表
 *   - 対局履歴 (各 Game の素点 / ポイント / 順位)
 *
 * The same screen renders P2 and P3 — the route is the only place that
 * knows which lookup found the Match. P3 currently always lands on
 * "URL が無効" because `02-domain-model.md` § Match has no Match-level
 * publicSlug yet; see `server/public.ts` file-level comment.
 *
 * モバイル 375pt 基準。
 */

import { Link } from '@tanstack/react-router';
import type { LeagueFormat, TobiRole } from '../../db/schema';
import type {
  PublicMatchData,
  PublicMatchGameResultRow,
  PublicMatchGameRow,
  PublicMatchRankingRow,
  PublicRulesetSummary,
} from './types';

export interface PublicMatchScreenProps {
  data: PublicMatchData;
}

const FORMAT_LABELS: Readonly<Record<LeagueFormat, string>> = {
  '4P_HANCHAN': '4人 半荘',
  '4P_TONPU': '4人 東風',
  '3P_HANCHAN': '3人 半荘',
  '3P_TONPU': '3人 東風',
};

const TOBI_LABEL: Readonly<Record<TobiRole, string>> = {
  INFLICTOR: '飛ばした',
  VICTIM: '飛んだ',
};

export function PublicMatchScreen({ data }: PublicMatchScreenProps) {
  return (
    <section className="space-y-6" data-testid="public-match-screen">
      <PublicMatchHeader data={data} />
      <PublicMatchRulesetCallout ruleset={data.defaultRuleset} />
      <PublicMatchRankingSection ranking={data.ranking} />
      <PublicMatchGamesSection games={data.games} />
    </section>
  );
}

function PublicMatchHeader({ data }: { data: PublicMatchData }) {
  return (
    <header className="space-y-3" data-testid="public-match-header">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Match</p>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-zinc-50">
          {data.sequenceNumber !== null ? `第 ${data.sequenceNumber} 節 ` : ''}
          {data.name}
        </h1>
        <p className="truncate text-sm text-zinc-400">
          {data.groupName}
          {data.leagueName !== null && data.leaguePublicSlug !== null ? (
            <>
              {' / '}
              <Link
                to="/l/$publicSlug"
                params={{ publicSlug: data.leaguePublicSlug }}
                className="text-emerald-300 underline-offset-2 hover:underline"
              >
                {data.leagueName}
              </Link>
            </>
          ) : null}
          {' / '}
          {FORMAT_LABELS[data.format]}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs">
        <div>
          <dt className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">開催日</dt>
          <dd className="mt-1 text-zinc-200">
            {data.heldAt === null ? '未設定' : formatDate(data.heldAt)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">対局数</dt>
          <dd className="mt-1 text-zinc-200">{data.games.length} 件</dd>
        </div>
        {data.memo !== null && data.memo.trim() !== '' ? (
          <div className="col-span-2">
            <dt className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">メモ</dt>
            <dd className="mt-1 whitespace-pre-wrap text-zinc-200">{data.memo}</dd>
          </div>
        ) : null}
      </dl>
    </header>
  );
}

function PublicMatchRulesetCallout({ ruleset }: { ruleset: PublicRulesetSummary | null }) {
  if (ruleset === null) {
    return (
      <section
        data-testid="public-match-ruleset-empty"
        className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-4 text-xs text-zinc-400"
      >
        既定の Ruleset は未設定です。
      </section>
    );
  }
  return (
    <section
      data-testid="public-match-ruleset"
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

function PublicMatchRankingSection({ ranking }: { ranking: ReadonlyArray<PublicMatchRankingRow> }) {
  return (
    <section className="space-y-3" data-testid="public-match-ranking-section">
      <h2 className="text-sm font-semibold text-zinc-200">順位表</h2>
      {ranking.length === 0 ? (
        <p
          data-testid="public-match-ranking-empty"
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
                  トップ
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  ラス
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900 text-zinc-200">
              {ranking.map((row, index) => (
                <tr key={row.playerId} data-testid={`public-match-ranking-row-${row.playerId}`}>
                  <td className="px-3 py-2 font-mono text-[11px] text-zinc-500">{index + 1}</td>
                  <td className="px-3 py-2">{row.playerName}</td>
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

function PublicMatchGamesSection({ games }: { games: ReadonlyArray<PublicMatchGameRow> }) {
  return (
    <section className="space-y-3" data-testid="public-match-games-section">
      <h2 className="text-sm font-semibold text-zinc-200">対局一覧</h2>
      {games.length === 0 ? (
        <p
          data-testid="public-match-games-empty"
          className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-5 text-center text-xs text-zinc-400"
        >
          まだ対局がありません。
        </p>
      ) : (
        <ul className="space-y-3" data-testid="public-match-games-list">
          {games.map((game) => (
            <PublicGameRow key={game.id} game={game} />
          ))}
        </ul>
      )}
    </section>
  );
}

function PublicGameRow({ game }: { game: PublicMatchGameRow }) {
  return (
    <li
      data-testid={`public-match-game-row-${game.id}`}
      className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3"
    >
      <p className="text-xs text-zinc-400">
        {formatDate(game.playedAt)} / {game.rulesetName}
      </p>
      <ul className="divide-y divide-zinc-900 rounded-lg border border-zinc-900 bg-zinc-950/40">
        {game.results.map((r) => (
          <PublicGameResultLine key={r.playerId} result={r} />
        ))}
      </ul>
    </li>
  );
}

function PublicGameResultLine({ result }: { result: PublicMatchGameResultRow }) {
  return (
    <li className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
      <span className="flex items-center gap-2 truncate text-zinc-100">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-300">
          {result.rank}
        </span>
        <span className="truncate">{result.playerName}</span>
        {result.tobiRole !== null ? (
          <span className="rounded-full bg-amber-900/40 px-2 py-0.5 text-[10px] text-amber-200">
            {TOBI_LABEL[result.tobiRole]}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 font-mono text-zinc-400">
        {result.rawScore.toLocaleString()}
        <span className="ml-2 text-emerald-300">{formatPointsSigned(result.points)}</span>
      </span>
    </li>
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
