/**
 * S9 Match 一覧 — League-スコープ / Owner 全 (`04-screens.md` § S9, Issue #19)
 * + Issue #22 で「マッチ一覧（グループ横断）」のリーグセレクタを追加。
 *
 * URL: `/matches?leagueId=…` で League-スコープ、無印で Owner の全 Match 横断。
 * spec の `/leagues/$leagueId/matches` は MVP では query-param 形式で代替
 * （`MatchCreateScreen` と同じ運用、bottom-nav の「マッチ」タブを起点に揃える）。
 *
 * The screen replaces the previous placeholder at `/matches`. Each card links
 * to `/matches/$matchId` (S9 detail). 「Match を追加」リンクは
 * `/matches/new` を `?leagueId=` 付きで開き、S10 のフォームを再利用する。
 *
 * リーグセレクタ (`#22`): cross-Group / League-scoped どちらの状態でも
 * 「すべて + 各リーグ」のチップを横スクロールで表示し、`?leagueId=` を切替
 * できる。同名リーグが別 Group にある場合は groupName を補助ラベルとして
 * 添える。Owner にまだ League が無い場合はセレクタを隠す（チップ「すべて」
 * 1 枚だけの UI は意味が無いため）。
 */

import { Link } from '@tanstack/react-router';
import type { MatchListItem, MatchListLeagueOption, MatchListScope } from './detail-types';

export interface MatchListScreenProps {
  matches: ReadonlyArray<MatchListItem>;
  scope: MatchListScope;
  leagueOptions: ReadonlyArray<MatchListLeagueOption>;
}

export function MatchListScreen({ matches, scope, leagueOptions }: MatchListScreenProps) {
  // Same-name disambiguation: when two leagues across different Groups share
  // a `name`, surface the Group as a sub-label so chips stay distinguishable.
  const nameDuplicates = new Set<string>();
  const seen = new Set<string>();
  for (const opt of leagueOptions) {
    if (seen.has(opt.name)) nameDuplicates.add(opt.name);
    seen.add(opt.name);
  }

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

      {leagueOptions.length > 0 ? (
        <nav
          aria-label="リーグセレクタ"
          data-testid="matches-league-selector"
          className="-mx-1 overflow-x-auto"
        >
          <ul className="flex items-center gap-2 px-1 pb-1">
            <li>
              <LeagueChip
                label="すべて"
                active={scope.leagueId === null}
                href="/matches"
                testId="matches-league-chip-all"
              />
            </li>
            {leagueOptions.map((option) => (
              <li key={option.id}>
                <LeagueChip
                  label={option.name}
                  sublabel={nameDuplicates.has(option.name) ? option.groupName : null}
                  active={scope.leagueId === option.id}
                  href="/matches"
                  searchLeagueId={option.id}
                  testId={`matches-league-chip-${option.id}`}
                />
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

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

interface LeagueChipProps {
  label: string;
  /** Optional second-line clarifier (Group name) when names collide. */
  sublabel?: string | null;
  active: boolean;
  href: '/matches';
  /** When omitted, the chip links to `/matches` with no search (= すべて). */
  searchLeagueId?: string;
  testId: string;
}

function LeagueChip({ label, sublabel, active, href, searchLeagueId, testId }: LeagueChipProps) {
  const search = searchLeagueId !== undefined ? { leagueId: searchLeagueId } : {};
  return (
    <Link
      to={href}
      search={search}
      data-testid={testId}
      aria-pressed={active}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors ${
        active
          ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200'
          : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100'
      }`}
    >
      <span>{label}</span>
      {sublabel ? <span className="text-[10px] text-zinc-500">/ {sublabel}</span> : null}
    </Link>
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
