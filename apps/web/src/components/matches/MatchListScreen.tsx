/**
 * S9 Match 一覧 — League-スコープ / Owner 全 (`04-screens.md` § S9, Issue #19).
 *
 * URL: `/matches?leagueId=…` で League-スコープ、無印で Owner の全 Match 横断。
 * spec の `/leagues/$leagueId/matches` は MVP では query-param 形式で代替
 * （`MatchCreateScreen` と同じ運用、bottom-nav の「マッチ」タブを起点に揃える）。
 *
 * The screen replaces the previous placeholder at `/matches`. Each card links
 * to `/matches/$matchId` (S9 detail). 「Match を追加」リンクは
 * `/matches/new` を `?leagueId=` 付きで開き、S10 のフォームを再利用する。
 */

import { Link } from '@tanstack/react-router';
import type { MatchListItem, MatchListScope } from './detail-types';

export interface MatchListScreenProps {
  matches: ReadonlyArray<MatchListItem>;
  scope: MatchListScope;
}

export function MatchListScreen({ matches, scope }: MatchListScreenProps) {
  return (
    <section className="space-y-5" data-testid="matches-screen">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Matches</p>
          <h1 className="text-2xl font-bold text-zinc-50">
            {scope.leagueId !== null && scope.leagueName !== null ? scope.leagueName : 'マッチ'}
          </h1>
          {scope.groupName !== null ? (
            <p className="mt-1 truncate text-sm text-zinc-400">
              {scope.groupName}
              {scope.leagueId !== null ? (
                <>
                  {' / '}
                  <Link
                    to="/leagues/$leagueId"
                    params={{ leagueId: scope.leagueId }}
                    className="text-emerald-300 hover:underline"
                  >
                    リーグ詳細
                  </Link>
                </>
              ) : null}
            </p>
          ) : (
            <p className="mt-1 text-sm text-zinc-400">あなたが管理するすべてのマッチ。</p>
          )}
        </div>
        <Link
          to="/matches/new"
          search={scope.createSearch}
          data-testid="matches-create-trigger"
          className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
        >
          マッチを追加
        </Link>
      </header>

      {matches.length === 0 ? (
        <p
          data-testid="matches-empty"
          className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-5 text-center text-xs text-zinc-400"
        >
          {scope.leagueId !== null
            ? 'このリーグにはまだマッチがありません。「マッチを追加」から最初のマッチを作成してください。'
            : 'マッチはまだありません。「マッチを追加」から作成できます。'}
        </p>
      ) : (
        <ul className="space-y-2" data-testid="matches-list">
          {matches.map((match) => (
            <li key={match.id} data-testid={`matches-list-item-${match.id}`}>
              <Link
                to="/matches/$matchId"
                params={{ matchId: match.id }}
                className="block rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 transition-colors hover:border-emerald-500/70"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-100">
                      {match.sequenceNumber !== null ? `第 ${match.sequenceNumber} 節 ` : ''}
                      {match.name}
                    </p>
                    <p className="mt-1 truncate text-xs text-zinc-500">
                      {scope.leagueId === null
                        ? match.leagueName === null
                          ? `${match.groupName} / League 外`
                          : `${match.groupName} / ${match.leagueName}`
                        : `対局 ${match.gameCount} 件`}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {match.heldAt === null
                      ? match.lastPlayedAt === null
                        ? '日付未設定'
                        : formatDate(match.lastPlayedAt)
                      : formatDate(match.heldAt)}
                  </span>
                </div>
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
