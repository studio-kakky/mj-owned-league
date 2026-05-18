/**
 * P1 League 公開ページ (`04-screens.md` § P1, Issue #23).
 *
 * Surfaces the four sections called out in `03-user-flow.md` § F8:
 *   - League 概要 (名前 / 形式 / 適用 Ruleset)
 *   - 順位表 (順位 / 対局数 / 合計 / 平均 / 1 位率 / 平均着順)
 *   - Match 一覧 (各 Match → P2 へリンク)
 *   - 個人成績への動線 (各プレイヤー名 → P4 へリンク)
 *
 * モバイル 375pt 基準。`sm:` 以上のブレークポイントは未使用。
 *
 * The screen is purely presentational; no editing affordance and no fetcher
 * — the route loader feeds it data from the public server function. This
 * mirrors the Owner-side `LeagueDetailScreen` so the two surfaces look like
 * obvious siblings, with the public one stripping the public-URL copy bar
 * (the viewer is *already* on that URL) and any "追加 / 編集" button.
 */

import type { PublicLeagueData } from '../types';
import { PublicLeagueHeader } from './PublicLeagueHeader';
import { PublicLeagueMatchesSection } from './PublicLeagueMatchesSection';
import { PublicLeagueRankingSection } from './PublicLeagueRankingSection';
import { PublicRulesetCallout } from './PublicRulesetCallout';

export interface PublicLeagueScreenProps {
  data: PublicLeagueData;
}

export const PublicLeagueScreen = ({ data }: PublicLeagueScreenProps) => {
  return (
    <section className="space-y-6" data-testid="public-league-screen">
      <PublicLeagueHeader data={data} />
      <PublicRulesetCallout ruleset={data.defaultRuleset} />
      <PublicLeagueRankingSection ranking={data.ranking} publicSlug={data.publicSlug} />
      <PublicLeagueMatchesSection matches={data.matches} publicSlug={data.publicSlug} />
    </section>
  );
};
