/**
 * P4 個人成績ページ (`04-screens.md` § P4, Issue #23).
 *
 * Surfaces the four sections from Issue #23:
 *   - プレイヤー名 + 所属 League への戻り導線
 *   - League 内集計指標 (対局数 / 合計ポイント / 平均ポイント / 1 位率 /
 *     平均着順 / ラス回数)
 *   - Match 別の成績テーブル (各 Match → P2 へリンク)
 *   - 対局履歴 (League 内、最新順)
 *
 * モバイル 375pt 基準。
 */

import type { PublicPlayerData } from '../types';
import { PublicPlayerGamesSection } from './PublicPlayerGamesSection';
import { PublicPlayerHeader } from './PublicPlayerHeader';
import { PublicPlayerMatchesSection } from './PublicPlayerMatchesSection';
import { PublicPlayerSummarySection } from './PublicPlayerSummarySection';

export interface PublicPlayerScreenProps {
  data: PublicPlayerData;
}

export const PublicPlayerScreen = ({ data }: PublicPlayerScreenProps) => {
  return (
    <section className="space-y-6" data-testid="public-player-screen">
      <PublicPlayerHeader data={data} />
      <PublicPlayerSummarySection summary={data.summary} />
      <PublicPlayerMatchesSection matches={data.matches} publicSlug={data.leaguePublicSlug} />
      <PublicPlayerGamesSection games={data.games} publicSlug={data.leaguePublicSlug} />
    </section>
  );
};
