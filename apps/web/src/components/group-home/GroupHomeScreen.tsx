/**
 * S6 Group 詳細 (ホーム) screen (`04-screens.md` § S6, Issue #16).
 *
 * Read-only "俯瞰ハブ" for a single Group: surfaces Group metadata, the
 * Leagues / Matches owned by the Group, the Group-wide ranking aggregated
 * from every `GameResult`, and the most recent Games. Each list section has
 * a「もっと見る」link to the relevant list screen (S7 リーグ一覧 /
 * S9 マッチ一覧) pre-filtered to this Group via the `?groupId=` query.
 *
 * Player 管理 / Ruleset 管理 are surfaced as links to Settings (S16, Issue
 * #17) — the spec decision in #24 keeps editable entities consolidated
 * there. See {@link SettingsLinkSection} for the rendering.
 *
 * Like {@link DashboardScreen} the component is purely presentational:
 *   - It takes the projection (`GroupHomeData`) as a prop.
 *   - It does no fetching of its own; the route loader (`routes/_owner/groups.$groupId.tsx`)
 *     owns the round trip.
 *   - It renders the same zinc-950 / emerald-500 visual language used
 *     elsewhere in the Owner shell, with a mobile-first single-column
 *     layout that comfortably fits 375pt.
 *
 * Why we don't reuse `DashboardSection` from `components/dashboard`:
 *   The dashboard's `DashboardSection` constrains `moreTo` to a small union
 *   (`/groups` | `/leagues` | `/matches`). The S6 home needs richer link
 *   targets (different `search` params per section, `/settings?groupId=…`),
 *   so we redeclare the section primitive locally. Promoting these to a
 *   shared module is a refactor we'll do after a third screen wants the
 *   same shape.
 */

import { Link } from '@tanstack/react-router';
import type {
  GroupHomeData,
  GroupHomeLeagueRow,
  GroupHomeMatchRow,
  GroupHomeRankingRow,
  GroupHomeRecentGameRow,
} from './types';

export interface GroupHomeScreenProps {
  data: GroupHomeData;
}

export function GroupHomeScreen({ data }: GroupHomeScreenProps) {
  return (
    <section className="space-y-6" data-testid="group-home-screen">
      <GroupHeader data={data} />
      <SettingsLinkSection groupId={data.id} />
      <LeaguesSection groupId={data.id} leagues={data.leagues} />
      <MatchesSection groupId={data.id} matches={data.matches} />
      <RankingSection ranking={data.ranking} />
      <RecentGamesSection games={data.recentGames} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page header — Group 概要
// ---------------------------------------------------------------------------

function GroupHeader({ data }: { data: GroupHomeData }) {
  return (
    <header className="space-y-3" data-testid="group-home-header">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Group</p>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-zinc-50">{data.name}</h1>
          <p className="mt-1 text-xs text-zinc-500">作成 {formatDate(data.createdAt)}</p>
        </div>
        <Link
          to="/groups"
          data-testid="group-home-back-link"
          className="shrink-0 rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 transition-colors hover:border-emerald-500/70"
        >
          一覧へ
        </Link>
      </div>
      <dl
        data-testid="group-home-summary"
        className="grid grid-cols-3 gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-center"
      >
        <SummaryPill
          testId="group-home-summary-players"
          label="プレイヤー"
          value={`${data.activePlayerCount} 人`}
        />
        <SummaryPill
          testId="group-home-summary-games"
          label="対局"
          value={`${data.totalGameCount} 局`}
        />
        <SummaryPill
          testId="group-home-summary-last-played"
          label="最終対局"
          value={data.lastPlayedAt === null ? '未対局' : formatDate(data.lastPlayedAt)}
        />
      </dl>
    </header>
  );
}

function SummaryPill({ testId, label, value }: { testId: string; label: string; value: string }) {
  return (
    <div data-testid={testId} className="flex flex-col gap-1">
      <dt className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</dt>
      <dd className="truncate text-sm font-semibold text-zinc-100">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings link section — Player / Ruleset 管理は Settings (#17) へ集約
// ---------------------------------------------------------------------------
// Per spec decision #24, editable Player / Ruleset surfaces live on the
// Settings screen, not on the Group home. We expose two link rows so the
// affordance is discoverable without duplicating the underlying list.

function SettingsLinkSection({ groupId }: { groupId: string }) {
  return (
    <section className="space-y-3" data-testid="group-home-settings-section">
      <h2 className="text-sm font-semibold text-zinc-200">グループ設定</h2>
      <ul className="grid gap-2 sm:grid-cols-2" data-testid="group-home-settings-links">
        <li>
          <Link
            to="/settings"
            search={{ groupId }}
            data-testid="group-home-settings-players-link"
            className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-emerald-500/70"
          >
            <span>
              <span className="block text-sm font-semibold text-zinc-100">プレイヤー管理</span>
              <span className="mt-1 block text-xs text-zinc-500">追加 / 編集 / 非アクティブ化</span>
            </span>
            <span className="shrink-0 text-xs text-emerald-300">設定 →</span>
          </Link>
        </li>
        <li>
          <Link
            to="/settings"
            search={{ groupId }}
            data-testid="group-home-settings-rulesets-link"
            className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-emerald-500/70"
          >
            <span>
              <span className="block text-sm font-semibold text-zinc-100">Ruleset 管理</span>
              <span className="mt-1 block text-xs text-zinc-500">追加 / 編集 / デフォルト切替</span>
            </span>
            <span className="shrink-0 text-xs text-emerald-300">設定 →</span>
          </Link>
        </li>
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Leagues section
// ---------------------------------------------------------------------------

function LeaguesSection({
  groupId,
  leagues,
}: {
  groupId: string;
  leagues: ReadonlyArray<GroupHomeLeagueRow>;
}) {
  return (
    <GroupHomeSection
      title="リーグ"
      moreLabel="リーグを開く"
      moreTo="/leagues"
      moreSearch={{ groupId }}
      testId="group-home-leagues-section"
    >
      {leagues.length === 0 ? (
        <EmptyState
          testId="group-home-leagues-empty"
          message="このグループにはまだリーグがありません。"
          ctaLabel="リーグへ移動"
          ctaTo="/leagues"
          ctaSearch={{ groupId }}
        />
      ) : (
        <ul className="space-y-2" data-testid="group-home-leagues-list">
          {leagues.map((league) => (
            <li key={league.id} data-testid={`group-home-league-row-${league.id}`}>
              <Link
                to="/leagues/$leagueId"
                params={{ leagueId: league.id }}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 transition-colors hover:border-emerald-500/70"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-100">{league.name}</p>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    マッチ {league.matchCount} 件 / 対局 {league.gameCount} 件
                  </p>
                </div>
                <span className="shrink-0 text-xs text-zinc-500">
                  {league.lastPlayedAt === null ? '未対局' : formatDate(league.lastPlayedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </GroupHomeSection>
  );
}

// ---------------------------------------------------------------------------
// Matches section (= マッチ履歴)
// ---------------------------------------------------------------------------

function MatchesSection({
  groupId,
  matches,
}: {
  groupId: string;
  matches: ReadonlyArray<GroupHomeMatchRow>;
}) {
  return (
    <GroupHomeSection
      title="マッチ履歴"
      moreLabel="マッチを開く"
      moreTo="/matches"
      moreSearch={{ groupId }}
      testId="group-home-matches-section"
    >
      {matches.length === 0 ? (
        <EmptyState
          testId="group-home-matches-empty"
          message="このグループにはまだマッチがありません。"
          ctaLabel="マッチへ移動"
          ctaTo="/matches"
          ctaSearch={{ groupId }}
        />
      ) : (
        <ul className="space-y-2" data-testid="group-home-matches-list">
          {matches.map((match) => (
            <li key={match.id} data-testid={`group-home-match-row-${match.id}`}>
              <Link
                to="/matches/$matchId"
                params={{ matchId: match.id }}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 transition-colors hover:border-emerald-500/70"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-100">
                    {match.sequenceNumber !== null ? `第 ${match.sequenceNumber} 節 ` : ''}
                    {match.name}
                  </p>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {match.leagueName === null ? 'League 外' : match.leagueName} / 対局{' '}
                    {match.gameCount} 件
                  </p>
                </div>
                <span className="shrink-0 text-xs text-zinc-500">
                  {match.heldAt === null ? '日付未設定' : formatDate(match.heldAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </GroupHomeSection>
  );
}

// ---------------------------------------------------------------------------
// Ranking section
// ---------------------------------------------------------------------------

function RankingSection({ ranking }: { ranking: ReadonlyArray<GroupHomeRankingRow> }) {
  return (
    <section className="space-y-3" data-testid="group-home-ranking-section">
      <h2 className="text-sm font-semibold text-zinc-200">ランキング</h2>
      {ranking.length === 0 ? (
        <p
          data-testid="group-home-ranking-empty"
          className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-5 text-center text-xs text-zinc-400"
        >
          対局結果がまだ登録されていません。対局を追加するとランキングが表示されます。
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
                <tr key={row.playerId} data-testid={`group-home-ranking-row-${row.playerId}`}>
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

// ---------------------------------------------------------------------------
// Recent games feed
// ---------------------------------------------------------------------------

function RecentGamesSection({ games }: { games: ReadonlyArray<GroupHomeRecentGameRow> }) {
  return (
    <GroupHomeSection
      title="直近の対局"
      moreLabel="マッチで確認"
      moreTo="/matches"
      moreSearch={undefined}
      testId="group-home-recent-games-section"
    >
      {games.length === 0 ? (
        <p
          data-testid="group-home-recent-games-empty"
          className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-5 text-center text-xs text-zinc-400"
        >
          まだ対局がありません。
        </p>
      ) : (
        <ul className="space-y-2" data-testid="group-home-recent-games-list">
          {games.map((game) => (
            <li
              key={game.id}
              data-testid={`group-home-recent-game-row-${game.id}`}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-100">
                    {game.matchName ?? 'カジュアル対局'}
                  </p>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {game.leagueName === null ? 'League 外' : game.leagueName}
                  </p>
                </div>
                <time className="shrink-0 text-xs text-zinc-500" dateTime={game.playedAt}>
                  {formatDate(game.playedAt)}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </GroupHomeSection>
  );
}

// ---------------------------------------------------------------------------
// Section + empty-state primitives (private to this file)
// ---------------------------------------------------------------------------
// The list of routes the section's "もっと見る" link may target. Excludes
// routes that don't exist yet (e.g. `/invitations`) so TanStack Router's
// strict `to` typing surfaces typos at compile time. The matching `search`
// shape is a narrow union — one entry per allowed route — so callers can't
// pass the wrong query.

type GroupHomeRoute = '/groups' | '/leagues' | '/matches';

type GroupHomeRouteSearch = undefined | { groupId: string } | { groupId: string; leagueId: string };

interface GroupHomeSectionProps {
  title: string;
  moreLabel: string;
  moreTo: GroupHomeRoute;
  moreSearch: GroupHomeRouteSearch;
  testId: string;
  children: React.ReactNode;
}

function GroupHomeSection({
  title,
  moreLabel,
  moreTo,
  moreSearch,
  testId,
  children,
}: GroupHomeSectionProps) {
  return (
    <section className="space-y-3" data-testid={testId}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
        <Link
          to={moreTo}
          search={moreSearch}
          className="text-xs text-emerald-300 transition-colors hover:text-emerald-200"
          data-testid={`${testId}-more`}
        >
          {moreLabel} →
        </Link>
      </div>
      {children}
    </section>
  );
}

interface EmptyStateProps {
  testId: string;
  message: string;
  ctaLabel: string;
  ctaTo: GroupHomeRoute;
  ctaSearch: GroupHomeRouteSearch;
}

function EmptyState({ testId, message, ctaLabel, ctaTo, ctaSearch }: EmptyStateProps) {
  return (
    <div
      data-testid={testId}
      className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-5 text-center"
    >
      <p className="text-sm text-zinc-300">{message}</p>
      <Link
        to={ctaTo}
        search={ctaSearch}
        className="mt-3 inline-block rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/**
 * Renders an ISO date / datetime string as `YYYY/MM/DD`. Invalid input falls
 * through as-is rather than blowing up the row — the home screen is read-only
 * surface and we'd rather show a slightly weird label than render nothing.
 *
 * Duplicated with `DashboardScreen.tsx` / `LeagueDetailScreen.tsx` on purpose:
 * extracting a shared `formatDate` utility is a refactor we will do the next
 * time a fourth screen needs the same format.
 */
function formatDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}
