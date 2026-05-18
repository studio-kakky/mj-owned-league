/**
 * S7 League 詳細 screen (`04-screens.md` § S7, Issue #18).
 *
 * Surfaces the four sections called out in the issue acceptance criteria:
 *   - 順位表 (League ranking)
 *   - Match 一覧
 *   - 対局履歴 (recent games feed)
 *   - 公開 URL (copy-to-clipboard)
 *
 * Ranking is computed from GameResult rows server-side (Issue #19): the
 * server walks every Game in the League, aggregates points / topCount /
 * lastCount per Player, and ships the rows pre-sorted. Leagues with no
 * recorded results still render the empty-state copy. When the D1 binding
 * lands (#39) the projection swaps from the in-memory store to a SQL query
 * without changing the wire shape.
 *
 * Public URL UX:
 *   The "公開 URL をコピー" button uses `navigator.clipboard.writeText` when
 *   available and falls back to selecting the URL in a hidden input. The
 *   fallback exists because some embedded browsers (older Safari WebKit on
 *   iOS, in particular) block the Clipboard API outside HTTPS — keeping the
 *   button functional there is preferable to silently failing.
 */

import type { LeagueDetailData } from '../types';
import { LeagueHeader } from './LeagueHeader';
import { MatchesSection } from './MatchesSection';
import { RankingSection } from './RankingSection';
import { RecentGamesSection } from './RecentGamesSection';
import { RulesetCallout } from './RulesetCallout';

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

export const LeagueDetailScreen = ({ data, origin }: LeagueDetailScreenProps) => {
  return (
    <section className="space-y-6" data-testid="league-detail-screen">
      <LeagueHeader data={data} origin={origin} />
      <RulesetCallout data={data} />
      <RankingSection ranking={data.ranking} />
      <MatchesSection matches={data.matches} leagueId={data.id} />
      <RecentGamesSection games={data.recentGames} />
    </section>
  );
};
