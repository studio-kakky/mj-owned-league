import type { MatchGameRow } from '../detail-types';
import { GameResultLine } from './GameResultLine';

const formatDate = (iso: string): string => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
};

const formatDateTime = (iso: string): string => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return formatDate(iso);
};

export const GameRow = ({
  game,
  onEdit,
  onDelete,
}: {
  game: MatchGameRow;
  onEdit: () => void;
  onDelete: () => void;
}) => {
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
};
