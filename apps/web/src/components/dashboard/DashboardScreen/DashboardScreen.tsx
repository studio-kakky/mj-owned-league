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

import type { DashboardData } from '../types';
import { ActiveLeaguesSection } from './ActiveLeaguesSection';
import { ActiveMatchesSection } from './ActiveMatchesSection';
import { GroupsSection } from './GroupsSection';
import { PageHeader } from './PageHeader';
import { RecentGamesSection } from './RecentGamesSection';

export interface DashboardScreenProps {
  data: DashboardData;
}

export const DashboardScreen = ({ data }: DashboardScreenProps) => {
  return (
    <section className="space-y-6" data-testid="dashboard-screen">
      <PageHeader pendingInvitationCount={data.pendingInvitationCount} />

      <GroupsSection groups={data.groups} />

      <ActiveLeaguesSection leagues={data.activeLeagues} />

      <ActiveMatchesSection matches={data.activeMatches} />

      <RecentGamesSection games={data.recentGames} />
    </section>
  );
};
