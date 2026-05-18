import type { MatchGameRow } from '../detail-types';
import { GameRow } from './GameRow';

export const GamesSection = ({
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
}) => {
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
};
