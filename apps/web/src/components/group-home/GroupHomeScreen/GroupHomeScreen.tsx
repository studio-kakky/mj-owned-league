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

import type { GroupHomeData } from '../types';
import { GroupHeader } from './GroupHeader';
import { LeaguesSection } from './LeaguesSection';
import { MatchesSection } from './MatchesSection';
import { RankingSection } from './RankingSection';
import { RecentGamesSection } from './RecentGamesSection';
import { SettingsLinkSection } from './SettingsLinkSection';

export interface GroupHomeScreenProps {
  data: GroupHomeData;
}

export const GroupHomeScreen = ({ data }: GroupHomeScreenProps) => {
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
};
