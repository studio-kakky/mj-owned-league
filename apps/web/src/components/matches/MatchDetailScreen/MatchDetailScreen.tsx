/**
 * S9 Match 詳細 screen (`04-screens.md` § S9, Issue #19).
 *
 * Surfaces the four sections from the issue acceptance criteria:
 *   - Match ヘッダー (名前 / 開催日 / メモ / 適用 Ruleset)
 *   - 順位表 (Match 内、totalPoints desc)
 *   - 対局一覧 (chronological desc; 各対局の素点 / ポイント / 順位)
 *   - 公開 URL（League 配下のときのみ、コピー機能つき）
 *
 * S11-S13 are rendered as in-screen modals per `04-screens.md` 注記:
 *   - "対局を追加" CTA → `GameFormModal` で S11
 *   - 各対局行の「編集」 → 同じ `GameFormModal` を S12 モードで開く
 *   - 削除 → `GameDeleteConfirmModal`
 *   - 「対局詳細」(S13) は独立画面を作らず、リスト行に素点 / ポイント / 順位を展開する
 *
 * Public URL UX mirrors `LeagueDetailScreen`: try `navigator.clipboard`, fall
 * back to `document.execCommand('copy')` on embedded browsers that block it.
 *
 * モバイル 375pt 基準。`sm:` 以上のブレークポイントは未使用。
 */

import { useCallback, useState } from 'react';
import type { LeagueFormat } from '../../../db/schema';
import type { GameSubmitInput, MatchDetailData, MatchGameRow } from '../detail-types';
import { GameDeleteConfirmModal } from '../GameDeleteConfirmModal';
import { GameFormModal } from '../GameFormModal';
import { GamesSection } from './GamesSection';
import { MatchHeader } from './MatchHeader';
import { RankingSection } from './RankingSection';
import { RulesetCallout } from './RulesetCallout';

export interface MatchDetailScreenProps {
  data: MatchDetailData;
  /** Origin override for tests; falls back to `window.location.origin`. */
  origin?: string;
  /** Persists the Game (S11 create / S12 edit). */
  onSubmitGame: (input: GameSubmitInput) => void | Promise<void>;
  /** Deletes a Game by id (S12 削除アクション). */
  onDeleteGame: (gameId: string) => void | Promise<void>;
}

const formatRequiresPlayers = (format: LeagueFormat): number => {
  return format.startsWith('3P') ? 3 : 4;
};

export const MatchDetailScreen = ({
  data,
  origin,
  onSubmitGame,
  onDeleteGame,
}: MatchDetailScreenProps) => {
  const expectedPlayerCount = formatRequiresPlayers(data.format);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<MatchGameRow | null>(null);
  const [deleting, setDeleting] = useState<MatchGameRow | null>(null);

  // Pre-fill `playedAt`: Match.heldAt → today.
  const todayIso = new Date().toISOString().slice(0, 10);
  const defaultPlayedAt = data.heldAt ?? todayIso;

  const handleCreateSubmit = useCallback(
    async (input: GameSubmitInput) => {
      await onSubmitGame(input);
      setCreateOpen(false);
    },
    [onSubmitGame],
  );

  const handleEditSubmit = useCallback(
    async (input: GameSubmitInput) => {
      await onSubmitGame(input);
      setEditing(null);
    },
    [onSubmitGame],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (deleting === null) return;
    await onDeleteGame(deleting.id);
    setDeleting(null);
  }, [deleting, onDeleteGame]);

  return (
    <section className="space-y-6" data-testid="match-detail-screen">
      <MatchHeader data={data} origin={origin} />

      <RulesetCallout ruleset={data.defaultRuleset} />

      <RankingSection ranking={data.ranking} />

      <GamesSection
        games={data.games}
        onAdd={() => setCreateOpen(true)}
        onEdit={(game) => setEditing(game)}
        onDelete={(game) => setDeleting(game)}
        canAdd={
          data.availablePlayers.length >= expectedPlayerCount && data.availableRulesets.length > 0
        }
      />

      <GameFormModal
        open={createOpen}
        matchId={data.id}
        expectedPlayerCount={expectedPlayerCount}
        availablePlayers={data.availablePlayers}
        availableRulesets={data.availableRulesets}
        defaultRulesetId={data.defaultRuleset?.id ?? data.availableRulesets[0]?.id ?? null}
        defaultPlayedAt={defaultPlayedAt}
        initialGame={null}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateSubmit}
      />

      <GameFormModal
        open={editing !== null}
        matchId={data.id}
        expectedPlayerCount={expectedPlayerCount}
        availablePlayers={data.availablePlayers}
        availableRulesets={data.availableRulesets}
        defaultRulesetId={editing?.rulesetId ?? data.defaultRuleset?.id ?? null}
        defaultPlayedAt={defaultPlayedAt}
        initialGame={editing}
        onClose={() => setEditing(null)}
        onSubmit={handleEditSubmit}
      />

      <GameDeleteConfirmModal
        open={deleting !== null}
        game={deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDeleteConfirm}
      />
    </section>
  );
};
