/**
 * S3 Owner ダッシュボード screen (`04-screens.md` § S3, Issue #14).
 *
 * Read-only "俯瞰ハブ": surfaces the Owner's Groups (cards), active
 * Leagues / Matches (summary lists), the most recent Games (feed), and the
 * count of unused (PENDING) invitations. Every section either has a "もっと
 * 見る" link to the relevant Owner screen (S4 / S15 / S9 / S14) or, when the
 * section is empty, an empty-state with a primary CTA.
 *
 * Like {@link GroupsScreen} the component is purely presentational:
 *   - It takes the projection (`DashboardData`) as a prop.
 *   - It does no fetching of its own; the route loader (S3 loader in
 *     `routes/_owner/index.tsx`) owns the round trip.
 *   - It renders the same zinc-950 / emerald-500 visual language used
 *     elsewhere in the Owner shell, with a mobile-first single-column
 *     layout that comfortably fits 375pt.
 *
 * Why we don't share `GroupListItem` with {@link GroupsScreen}:
 *   - The dashboard does not need `leagueCount` / `hasHistory`; surfacing
 *     them would force the server function to do extra work for data the
 *     screen never uses.
 *   - The two screens are likely to diverge as the dashboard grows (per the
 *     S3 column "備考: 直近活動を俯瞰するハブ"); keeping the projections
 *     separate makes that drift cheap.
 */

import { Link } from '@tanstack/react-router';
import type {
  DashboardActiveLeague,
  DashboardActiveMatch,
  DashboardData,
  DashboardGroupCard,
  DashboardRecentGame,
} from './types';

export interface DashboardScreenProps {
  data: DashboardData;
}

export function DashboardScreen({ data }: DashboardScreenProps) {
  return (
    <section className="space-y-6" data-testid="dashboard-screen">
      <PageHeader pendingInvitationCount={data.pendingInvitationCount} />

      <GroupsSection groups={data.groups} />

      <ActiveLeaguesSection leagues={data.activeLeagues} />

      <ActiveMatchesSection matches={data.activeMatches} />

      <RecentGamesSection games={data.recentGames} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page header
// ---------------------------------------------------------------------------
// The header carries the page title plus the "未使用の招待件数" pill. The pill
// is rendered as a Link to S14 (招待管理) so the count is also the affordance
// for managing them — collapsing two things into one chip keeps the header
// compact on 375pt.

function PageHeader({ pendingInvitationCount }: { pendingInvitationCount: number }) {
  // The pill is now a Link to S14 (`/invitations`, Issue #21). It surfaces the
  // PENDING-and-unexpired count and acts as the navigation affordance for
  // managing them — collapsing two things into one chip keeps the header
  // compact on 375pt. Hover state mirrors the active-leagues / active-matches
  // cards so the affordance reads as "tappable" without a separate icon.
  return (
    <header className="space-y-2" data-testid="dashboard-header">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Dashboard</p>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">ホーム</h1>
          <p className="mt-1 text-sm text-zinc-400">直近の活動を俯瞰するハブです。</p>
        </div>
        <Link
          to="/invitations"
          data-testid="dashboard-invitations-pill"
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-emerald-500/70 hover:text-zinc-50"
        >
          <span>招待</span>
          <span
            data-testid="dashboard-invitations-count"
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-semibold leading-none text-zinc-950"
          >
            {pendingInvitationCount}
          </span>
        </Link>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Groups section — `04-screens.md` § S3 "自分の Group 一覧（カード）"
// ---------------------------------------------------------------------------

function GroupsSection({ groups }: { groups: ReadonlyArray<DashboardGroupCard> }) {
  return (
    <DashboardSection
      title="自分のグループ"
      moreLabel="すべてのグループ"
      moreTo="/groups"
      testId="dashboard-groups-section"
    >
      {groups.length === 0 ? (
        <EmptyState
          testId="dashboard-groups-empty"
          message="グループはまだありません。"
          ctaLabel="グループを作成"
          ctaTo="/groups"
        />
      ) : (
        <ul className="space-y-3" data-testid="dashboard-groups-list">
          {groups.map((group) => (
            <li key={group.id} data-testid={`dashboard-group-card-${group.id}`}>
              <Link
                to="/groups/$groupId"
                params={{ groupId: group.id }}
                className="block rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-emerald-500/70"
              >
                <p className="truncate text-sm font-semibold text-zinc-100">{group.name}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  プレイヤー {group.playerCount} 人 / 最終対局{' '}
                  {group.lastPlayedAt === null ? '未対局' : formatDate(group.lastPlayedAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}

// ---------------------------------------------------------------------------
// Active leagues / matches sections
// ---------------------------------------------------------------------------

function ActiveLeaguesSection({ leagues }: { leagues: ReadonlyArray<DashboardActiveLeague> }) {
  return (
    <DashboardSection
      title="アクティブなリーグ"
      moreLabel="リーグを開く"
      moreTo="/leagues"
      testId="dashboard-leagues-section"
    >
      {leagues.length === 0 ? (
        <EmptyState
          testId="dashboard-leagues-empty"
          message="アクティブなリーグはまだありません。"
          ctaLabel="リーグへ移動"
          ctaTo="/leagues"
        />
      ) : (
        <ul className="space-y-2" data-testid="dashboard-leagues-list">
          {leagues.map((league) => (
            <li key={league.id} data-testid={`dashboard-league-row-${league.id}`}>
              <Link
                to="/leagues"
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-emerald-500/70"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-100">{league.name}</p>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {league.groupName} / マッチ {league.matchCount} 件 / 対局 {league.gameCount} 件
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
    </DashboardSection>
  );
}

function ActiveMatchesSection({ matches }: { matches: ReadonlyArray<DashboardActiveMatch> }) {
  return (
    <DashboardSection
      title="アクティブなマッチ"
      moreLabel="マッチを開く"
      moreTo="/matches"
      testId="dashboard-matches-section"
    >
      {matches.length === 0 ? (
        <EmptyState
          testId="dashboard-matches-empty"
          message="アクティブなマッチはまだありません。"
          ctaLabel="マッチへ移動"
          ctaTo="/matches"
        />
      ) : (
        <ul className="space-y-2" data-testid="dashboard-matches-list">
          {matches.map((match) => (
            <li key={match.id} data-testid={`dashboard-match-row-${match.id}`}>
              <Link
                to="/matches"
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-emerald-500/70"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-100">{match.name}</p>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {match.groupName}
                    {match.leagueName === null ? '' : ` / ${match.leagueName}`} / 対局{' '}
                    {match.gameCount} 件
                  </p>
                </div>
                <span className="shrink-0 text-xs text-zinc-500">
                  {match.heldAt === null ? '未開催' : formatDate(match.heldAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}

// ---------------------------------------------------------------------------
// Recent games feed
// ---------------------------------------------------------------------------

function RecentGamesSection({ games }: { games: ReadonlyArray<DashboardRecentGame> }) {
  return (
    <DashboardSection
      title="直近の対局"
      moreLabel="マッチで確認"
      moreTo="/matches"
      testId="dashboard-recent-games-section"
    >
      {games.length === 0 ? (
        <EmptyState
          testId="dashboard-recent-games-empty"
          message="まだ対局がありません。"
          ctaLabel="マッチで対局を追加"
          ctaTo="/matches"
        />
      ) : (
        <ul className="space-y-2" data-testid="dashboard-recent-games-list">
          {games.map((game) => (
            <li
              key={game.id}
              data-testid={`dashboard-recent-game-row-${game.id}`}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-100">
                    {game.matchName ?? 'カジュアル対局'}
                  </p>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {game.groupName}
                    {game.leagueName === null ? '' : ` / ${game.leagueName}`}
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
    </DashboardSection>
  );
}

// ---------------------------------------------------------------------------
// Section + empty-state primitives (private to this file)
// ---------------------------------------------------------------------------
// Extracted because each dashboard section shares the same chrome — a header
// row with title + "もっと見る" link, plus an empty-state CTA. Keeping these
// inline (instead of in `components/groups/` or a separate file) keeps the
// dashboard self-contained; if a third screen wants the same pattern we
// promote them then.

// The `moreTo` union is restricted to routes that currently exist in
// `routeTree.gen.ts`. `/invitations` is included since Issue #21 registered
// the route (the header pill links there directly; the section-level
// "もっと見る" link uses one of these three).
type DashboardRoute = '/groups' | '/leagues' | '/matches' | '/invitations';

interface DashboardSectionProps {
  title: string;
  moreLabel: string;
  moreTo: DashboardRoute;
  testId: string;
  children: React.ReactNode;
}

function DashboardSection({ title, moreLabel, moreTo, testId, children }: DashboardSectionProps) {
  return (
    <section className="space-y-3" data-testid={testId}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
        <Link
          to={moreTo}
          className="text-xs text-emerald-300 transition-colors hover:text-emerald-200"
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
  ctaTo: DashboardRoute;
}

function EmptyState({ testId, message, ctaLabel, ctaTo }: EmptyStateProps) {
  return (
    <div
      data-testid={testId}
      className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-5 text-center"
    >
      <p className="text-sm text-zinc-300">{message}</p>
      <Link
        to={ctaTo}
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
 * through as-is rather than blowing up the row — the dashboard is read-only
 * surface and we'd rather show a slightly weird label than show nothing.
 *
 * Duplicated with the helper inside `GroupsScreen.tsx` on purpose: extracting
 * a shared `formatDate` utility is a refactor that would touch both screens
 * for no behaviour change. We can DRY it up the next time a third screen
 * needs the same format.
 */
function formatDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}
