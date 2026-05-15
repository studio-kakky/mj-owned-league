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

import { Link } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import type { LeagueFormat, TobiRole } from '../../db/schema';
import type {
  GameSubmitInput,
  MatchDetailData,
  MatchGameResultRow,
  MatchGameRow,
  MatchRankingRow,
} from './detail-types';
import { GameDeleteConfirmModal } from './GameDeleteConfirmModal';
import { GameFormModal } from './GameFormModal';

export interface MatchDetailScreenProps {
  data: MatchDetailData;
  /** Origin override for tests; falls back to `window.location.origin`. */
  origin?: string;
  /** Persists the Game (S11 create / S12 edit). */
  onSubmitGame: (input: GameSubmitInput) => void | Promise<void>;
  /** Deletes a Game by id (S12 削除アクション). */
  onDeleteGame: (gameId: string) => void | Promise<void>;
}

const FORMAT_LABELS: Readonly<Record<LeagueFormat, string>> = {
  '4P_HANCHAN': '4人 半荘',
  '4P_TONPU': '4人 東風',
  '3P_HANCHAN': '3人 半荘',
  '3P_TONPU': '3人 東風',
};

const TOBI_LABEL: Readonly<Record<TobiRole, string>> = {
  INFLICTOR: '飛ばした',
  VICTIM: '飛んだ',
};

function formatRequiresPlayers(format: LeagueFormat): number {
  return format.startsWith('3P') ? 3 : 4;
}

export function MatchDetailScreen({
  data,
  origin,
  onSubmitGame,
  onDeleteGame,
}: MatchDetailScreenProps) {
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
}

// ---------------------------------------------------------------------------
// Header — title + meta + public URL copy
// ---------------------------------------------------------------------------

function MatchHeader({ data, origin }: { data: MatchDetailData; origin?: string }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  // Public URL only exists when this Match belongs to a League — League-外
  // Match's public surface is `/m/:publicSlug` which is not modelled yet.
  const publicPath =
    data.leaguePublicSlug !== null && data.sequenceNumber !== null
      ? `/l/${data.leaguePublicSlug}/matches/${data.sequenceNumber}`
      : null;
  const publicUrl =
    publicPath === null
      ? null
      : (origin ?? (typeof window === 'undefined' ? '' : window.location.origin)) + publicPath;

  const handleCopy = useCallback(async () => {
    if (publicUrl === null) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(publicUrl);
      } else {
        const helper = document.createElement('textarea');
        helper.value = publicUrl;
        helper.style.position = 'fixed';
        helper.style.opacity = '0';
        document.body.appendChild(helper);
        helper.select();
        document.execCommand('copy');
        helper.remove();
      }
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('error');
      window.setTimeout(() => setCopyState('idle'), 2500);
    }
  }, [publicUrl]);

  return (
    <header className="space-y-3" data-testid="match-detail-header">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Match</p>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-zinc-50">
            {data.sequenceNumber !== null ? `第 ${data.sequenceNumber} 節 ` : ''}
            {data.name}
          </h1>
          <p className="mt-1 truncate text-sm text-zinc-400">
            {data.groupName}
            {data.leagueId !== null && data.leagueName !== null ? (
              <>
                {' / '}
                <Link
                  to="/leagues/$leagueId"
                  params={{ leagueId: data.leagueId }}
                  className="text-emerald-300 hover:underline"
                >
                  {data.leagueName}
                </Link>
              </>
            ) : null}
            {' / '}
            {FORMAT_LABELS[data.format]}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs">
        <div>
          <dt className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">開催日</dt>
          <dd className="mt-1 text-zinc-200">
            {data.heldAt === null ? '未設定' : formatDate(data.heldAt)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">対局数</dt>
          <dd className="mt-1 text-zinc-200">{data.games.length} 件</dd>
        </div>
        {data.memo !== null && data.memo.trim() !== '' ? (
          <div className="col-span-2">
            <dt className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">メモ</dt>
            <dd className="mt-1 whitespace-pre-wrap text-zinc-200">{data.memo}</dd>
          </div>
        ) : null}
      </dl>

      {publicUrl !== null ? (
        <div
          data-testid="match-detail-public-url"
          className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3"
        >
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">公開 URL</p>
            <p className="mt-1 truncate text-xs text-zinc-300">{publicUrl}</p>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            data-testid="match-detail-public-url-copy"
            className="shrink-0 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
          >
            {copyState === 'copied' ? 'コピーしました' : copyState === 'error' ? '失敗' : 'コピー'}
          </button>
        </div>
      ) : null}
    </header>
  );
}

function RulesetCallout({ ruleset }: { ruleset: MatchDetailData['defaultRuleset'] }) {
  if (ruleset === null) {
    return (
      <section
        data-testid="match-detail-ruleset-empty"
        className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-4 text-xs text-zinc-400"
      >
        既定の Ruleset が未設定です。最初の対局を追加するときに Ruleset を選択してください。
      </section>
    );
  }
  return (
    <section
      data-testid="match-detail-ruleset"
      className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
    >
      <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">適用 Ruleset</p>
      <p className="text-sm font-semibold text-zinc-100">
        {ruleset.name}
        {ruleset.isMatchDefault ? (
          <span className="ml-2 text-[10px] font-medium text-emerald-300">マッチの既定</span>
        ) : ruleset.isGroupDefault ? (
          <span className="ml-2 text-[10px] font-medium text-zinc-400">グループの既定</span>
        ) : null}
      </p>
      <p className="text-xs text-zinc-500">
        持ち点 {ruleset.startingScore.toLocaleString()} / 返し点{' '}
        {ruleset.returnScore.toLocaleString()} / ウマ {ruleset.umaPattern}
        {ruleset.tobiEnabled ? ` / 飛び賞 ${ruleset.tobiPoint ?? 0}` : ' / 飛び賞なし'}
      </p>
    </section>
  );
}

function RankingSection({ ranking }: { ranking: ReadonlyArray<MatchRankingRow> }) {
  return (
    <section className="space-y-3" data-testid="match-detail-ranking-section">
      <h2 className="text-sm font-semibold text-zinc-200">順位表</h2>
      {ranking.length === 0 ? (
        <p
          data-testid="match-detail-ranking-empty"
          className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-5 text-center text-xs text-zinc-400"
        >
          対局結果がまだ登録されていません。「対局を追加」から最初の対局を記録してください。
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
                <th scope="col" className="px-3 py-2 text-right">
                  トップ
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  ラス
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900 text-zinc-200">
              {ranking.map((row, index) => (
                <tr key={row.playerId} data-testid={`match-detail-ranking-row-${row.playerId}`}>
                  <td className="px-3 py-2 font-mono text-[11px] text-zinc-500">{index + 1}</td>
                  <td className="px-3 py-2">{row.playerName}</td>
                  <td className="px-3 py-2 text-right">{row.gameCount}</td>
                  <td className="px-3 py-2 text-right">
                    {row.totalPoints.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {row.averagePoints.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-right">{row.topCount}</td>
                  <td className="px-3 py-2 text-right">{row.lastCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function GamesSection({
  games,
  onAdd,
  onEdit,
  onDelete,
  canAdd,
}: {
  games: ReadonlyArray<MatchGameRow>;
  onAdd: () => void;
  onEdit: (game: MatchGameRow) => void;
  onDelete: (game: MatchGameRow) => void;
  canAdd: boolean;
}) {
  return (
    <section className="space-y-3" data-testid="match-detail-games-section">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-200">対局一覧</h2>
        <button
          type="button"
          onClick={onAdd}
          disabled={!canAdd}
          data-testid="match-detail-add-game"
          className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          対局を追加
        </button>
      </div>
      {!canAdd ? (
        <p
          data-testid="match-detail-add-game-disabled"
          className="rounded-xl border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-100"
        >
          対局を追加するには、アクティブなプレイヤーと利用可能な Ruleset が必要です。
        </p>
      ) : null}
      {games.length === 0 ? (
        <p
          data-testid="match-detail-games-empty"
          className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-5 text-center text-xs text-zinc-400"
        >
          まだ対局がありません。
        </p>
      ) : (
        <ul className="space-y-3" data-testid="match-detail-games-list">
          {games.map((game) => (
            <GameRow
              key={game.id}
              game={game}
              onEdit={() => onEdit(game)}
              onDelete={() => onDelete(game)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function GameRow({
  game,
  onEdit,
  onDelete,
}: {
  game: MatchGameRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      data-testid={`match-detail-game-row-${game.id}`}
      className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-zinc-400">
          {formatDateTime(game.playedAt)} / {game.rulesetName}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            data-testid={`match-detail-game-edit-${game.id}`}
            className="rounded-full px-3 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
          >
            編集
          </button>
          <button
            type="button"
            onClick={onDelete}
            data-testid={`match-detail-game-delete-${game.id}`}
            className="rounded-full px-3 py-1 text-[11px] text-rose-300 hover:bg-rose-950/50"
          >
            削除
          </button>
        </div>
      </div>
      <ul className="divide-y divide-zinc-900 rounded-lg border border-zinc-900 bg-zinc-950/40">
        {game.results.map((r) => (
          <GameResultLine key={r.playerId} result={r} />
        ))}
      </ul>
    </li>
  );
}

function GameResultLine({ result }: { result: MatchGameResultRow }) {
  return (
    <li className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
      <span className="flex items-center gap-2 truncate text-zinc-100">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-300">
          {result.rank}
        </span>
        <span className="truncate">{result.playerName}</span>
        {result.tobiRole !== null ? (
          <span className="rounded-full bg-amber-900/40 px-2 py-0.5 text-[10px] text-amber-200">
            {TOBI_LABEL[result.tobiRole]}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 font-mono text-zinc-400">
        {result.rawScore.toLocaleString()}
        <span className="ml-2 text-emerald-300">{formatPointsSigned(result.points)}</span>
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}

function formatDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return formatDate(iso);
}

function formatPointsSigned(value: number): string {
  const formatted = value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return value > 0 ? `+${formatted}` : formatted;
}
