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

import type { PublicMatchData } from '../types';
import { PublicMatchGamesSection } from './PublicMatchGamesSection';
import { PublicMatchHeader } from './PublicMatchHeader';
import { PublicMatchRankingSection } from './PublicMatchRankingSection';
import { PublicMatchRulesetCallout } from './PublicMatchRulesetCallout';

export interface PublicMatchScreenProps {
  data: PublicMatchData;
}

export const PublicMatchScreen = ({ data }: PublicMatchScreenProps) => {
  return (
    <section className="space-y-6" data-testid="public-match-screen">
      <PublicMatchHeader data={data} />
      <PublicMatchRulesetCallout ruleset={data.defaultRuleset} />
      <PublicMatchRankingSection ranking={data.ranking} />
      <PublicMatchGamesSection games={data.games} />
    </section>
  );
};
