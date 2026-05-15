/**
 * S7 League 詳細 screen (`04-screens.md` § S7, Issue #18).
 *
 * Surfaces the four sections called out in the issue acceptance criteria:
 *   - 順位表 (League ranking)
 *   - Match 一覧
 *   - 対局履歴 (recent games feed)
 *   - 公開 URL (copy-to-clipboard)
 *
 * Why ranking is rendered as an empty-state instead of a real table:
 *   The interim in-memory store (`groups-store.ts`) does not yet model
 *   `GameResult` rows. The server projects `ranking: []`. The screen still
 *   has the section so the layout is final; we surface explanatory copy
 *   pointing the user at the `直近の対局` feed as a fallback. When the D1
 *   binding lands (#39) and the server starts computing ranking from
 *   GameResult, this section becomes populated without touching the screen.
 *
 * Public URL UX:
 *   The "公開 URL をコピー" button uses `navigator.clipboard.writeText` when
 *   available and falls back to selecting the URL in a hidden input. The
 *   fallback exists because some embedded browsers (older Safari WebKit on
 *   iOS, in particular) block the Clipboard API outside HTTPS — keeping the
 *   button functional there is preferable to silently failing.
 */

import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import type { LeagueFormat } from '../../db/schema';
import type { LeagueDetailData, LeagueGameRow, LeagueMatchRow, LeagueRankingRow } from './types';

export interface LeagueDetailScreenProps {
  data: LeagueDetailData;
  /**
   * Origin override used by tests so they don't depend on
   * `window.location.origin`. Production renders pass it through from the
   * route loader (`new URL(...)` evaluated server-side) so the copied URL is
   * absolute even when the browser tab is `chrome://newtab` style.
   */
  origin?: string;
}

const FORMAT_LABELS: Readonly<Record<LeagueFormat, string>> = {
  '4P_HANCHAN': '4人 半荘',
  '4P_TONPU': '4人 東風',
  '3P_HANCHAN': '3人 半荘',
  '3P_TONPU': '3人 東風',
};

export function LeagueDetailScreen({ data, origin }: LeagueDetailScreenProps) {
  return (
    <section className="space-y-6" data-testid="league-detail-screen">
      <LeagueHeader data={data} origin={origin} />
      <RulesetCallout data={data} />
      <RankingSection ranking={data.ranking} />
      <MatchesSection matches={data.matches} leagueId={data.id} />
      <RecentGamesSection games={data.recentGames} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Header — title + status + public URL copy
// ---------------------------------------------------------------------------

function LeagueHeader({ data, origin }: { data: LeagueDetailData; origin?: string }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  const publicPath = `/l/${data.publicSlug}`;
  // Prefer the explicit prop; fall back to the browser's runtime origin so
  // the copied URL is absolute. In SSR we get the empty string — the button
  // is still safe to render; clicking it copies the relative path.
  const publicUrl =
    (origin ?? (typeof window === 'undefined' ? '' : window.location.origin)) + publicPath;

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(publicUrl);
      } else {
        // Fallback path — see file-level comment for why this exists. We use
        // `document.execCommand('copy')` deliberately; modern lint rules flag
        // it as deprecated, but the only call site is the no-clipboard
        // fallback and `navigator.clipboard` is the happy path.
        const helper = document.createElement('textarea');
        helper.value = publicUrl;
        helper.style.position = 'fixed';
        helper.style.opacity = '0';
        document.body.appendChild(helper);
        helper.select();
        document.execCommand('copy');
        helper.remove();
      }
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('error');
      window.setTimeout(() => setCopyState('idle'), 2500);
    }
  };

  return (
    <header className="space-y-3" data-testid="league-detail-header">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">League</p>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">{data.name}</h1>
          <p className="mt-1 truncate text-sm text-zinc-400">
            {data.groupName} / {FORMAT_LABELS[data.format]}
          </p>
        </div>
        <span
          data-testid="league-detail-status"
          className="inline-flex shrink-0 items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200"
        >
          {data.status === 'ACTIVE' ? '進行中' : '終了'}
        </span>
      </div>

      <div
        data-testid="league-detail-public-url"
        className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3"
      >
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">公開 URL</p>
          <p className="mt-1 truncate text-xs text-zinc-300">{publicUrl || publicPath}</p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          data-testid="league-detail-public-url-copy"
          className="shrink-0 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
        >
          {copyState === 'copied' ? 'コピーしました' : copyState === 'error' ? '失敗' : 'コピー'}
        </button>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function RulesetCallout({ data }: { data: LeagueDetailData }) {
  if (data.defaultRuleset === null) {
    return (
      <section
        data-testid="league-detail-ruleset-empty"
        className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-4 text-xs text-zinc-400"
      >
        既定の Ruleset は未設定です。各対局で個別に Ruleset を選択してください。
      </section>
    );
  }
  const r = data.defaultRuleset;
  return (
    <section
      data-testid="league-detail-ruleset"
      className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
    >
      <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">適用 Ruleset</p>
      <p className="text-sm font-semibold text-zinc-100">
        {r.name}
        {r.isGroupDefault ? (
          <span className="ml-2 text-[10px] font-medium text-emerald-300">グループの既定</span>
        ) : null}
      </p>
      <p className="text-xs text-zinc-500">
        持ち点 {r.startingScore.toLocaleString()} / 返し点 {r.returnScore.toLocaleString()} / ウマ{' '}
        {r.umaPattern}
      </p>
    </section>
  );
}

function RankingSection({ ranking }: { ranking: ReadonlyArray<LeagueRankingRow> }) {
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
}

function MatchesSection({
  matches,
  leagueId,
}: {
  matches: ReadonlyArray<LeagueMatchRow>;
  leagueId: string;
}) {
  return (
    <section className="space-y-3" data-testid="league-detail-matches-section">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-200">マッチ</h2>
        <Link
          to="/matches/new"
          search={{ leagueId }}
          data-testid="league-detail-match-create-link"
          className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
        >
          マッチを追加
        </Link>
      </div>
      {matches.length === 0 ? (
        <p
          data-testid="league-detail-matches-empty"
          className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-5 text-center text-xs text-zinc-400"
        >
          このリーグにはまだマッチがありません。
        </p>
      ) : (
        <ul className="space-y-2" data-testid="league-detail-matches-list">
          {matches.map((match) => (
            <li
              key={match.id}
              data-testid={`league-detail-match-row-${match.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-100">
                  {match.sequenceNumber !== null ? `第 ${match.sequenceNumber} 節 ` : ''}
                  {match.name}
                </p>
                <p className="mt-1 truncate text-xs text-zinc-500">
                  対局 {match.gameCount} 件
                  {match.heldAt === null ? '' : ` / ${formatDate(match.heldAt)}`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentGamesSection({ games }: { games: ReadonlyArray<LeagueGameRow> }) {
  return (
    <section className="space-y-3" data-testid="league-detail-games-section">
      <h2 className="text-sm font-semibold text-zinc-200">直近の対局</h2>
      {games.length === 0 ? (
        <p
          data-testid="league-detail-games-empty"
          className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-5 text-center text-xs text-zinc-400"
        >
          まだ対局がありません。
        </p>
      ) : (
        <ul className="space-y-2" data-testid="league-detail-games-list">
          {games.map((game) => (
            <li
              key={game.id}
              data-testid={`league-detail-game-row-${game.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3"
            >
              <p className="min-w-0 truncate text-sm text-zinc-200">
                {game.matchName ?? 'カジュアル対局'}
              </p>
              <time className="shrink-0 text-xs text-zinc-500" dateTime={game.playedAt}>
                {formatDate(game.playedAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}
