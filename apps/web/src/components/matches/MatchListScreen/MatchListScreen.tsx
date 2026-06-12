/**
 * S9 Match 一覧 — グループ配下 (`04-screens.md` § S9, Issue #61).
 *
 * URL: `/groups/:groupId/matches` で当該グループの全 Match、
 * `?leagueId=…` で同一グループ内のリーグに絞り込み。`groupId` は常に URL
 * パス起点なので、横断 (cross-Group) UI / groupName ラベルは廃止した（Issue
 * #61）。
 *
 * 各カードは `/groups/$groupId/matches/$matchId`（S9 detail）へリンクする。
 * 「マッチを追加」リンクは `/groups/$groupId/matches/new` を `?leagueId=` 付き
 * で開き、S10 のフォームを再利用する。
 *
 * リーグセレクタ: 当該グループ内のリーグのみを「すべて + 各リーグ」のチップ
 * として横スクロールで表示し、`?leagueId=` を切替できる。同一グループ内に
 * 限定したため同名リーグの Group 区別ラベルは不要。グループにまだ League が
 * 無い場合はセレクタを隠す（チップ「すべて」1 枚だけの UI は意味が無い）。
 */

import { Link } from '@tanstack/react-router';
import type { MatchListItem, MatchListLeagueOption, MatchListScope } from '../detail-types';
import { LeagueChip } from './LeagueChip';

export interface MatchListScreenProps {
  /** The Group the list is scoped to — threaded into every group-scoped link. */
  groupId: string;
  matches: ReadonlyArray<MatchListItem>;
  scope: MatchListScope;
  leagueOptions: ReadonlyArray<MatchListLeagueOption>;
}

export const MatchListScreen = ({
  groupId,
  matches,
  scope,
  leagueOptions,
}: MatchListScreenProps) => {
  return (
    <section className="space-y-5" data-testid="matches-screen">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Matches</p>
          <h1 className="text-2xl font-bold text-zinc-50">
            {scope.leagueId !== null && scope.leagueName !== null ? scope.leagueName : 'マッチ'}
          </h1>
          {scope.leagueId !== null ? (
            <p className="mt-1 truncate text-sm text-zinc-400">
              <Link
                to="/groups/$groupId/leagues/$leagueId"
                params={{ groupId, leagueId: scope.leagueId }}
                className="text-emerald-300 hover:underline"
              >
                リーグ詳細
              </Link>
            </p>
          ) : (
            <p className="mt-1 text-sm text-zinc-400">このグループのすべてのマッチ。</p>
          )}
        </div>
        <Link
          to="/groups/$groupId/matches/new"
          params={{ groupId }}
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
                groupId={groupId}
                label="すべて"
                active={scope.leagueId === null}
                testId="matches-league-chip-all"
              />
            </li>
            {leagueOptions.map((option) => (
              <li key={option.id}>
                <LeagueChip
                  groupId={groupId}
                  label={option.name}
                  active={scope.leagueId === option.id}
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
                to="/groups/$groupId/matches/$matchId"
                params={{ groupId, matchId: match.id }}
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
                          ? 'League 外'
                          : match.leagueName
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
};

const formatDate = (iso: string): string => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
};
