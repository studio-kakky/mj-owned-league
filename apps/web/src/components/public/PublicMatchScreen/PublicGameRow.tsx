import type { PublicMatchGameRow as PublicMatchGameRowData } from '../types';
import { PublicGameResultLine } from './PublicGameResultLine';

const formatDate = (iso: string): string => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
};

export const PublicGameRow = ({ game }: { game: PublicMatchGameRowData }) => {
  return (
    <li
      data-testid={`public-match-game-row-${game.id}`}
      className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3"
    >
      <p className="text-xs text-zinc-400">
        {formatDate(game.playedAt)} / {game.rulesetName}
      </p>
      <ul className="divide-y divide-zinc-900 rounded-lg border border-zinc-900 bg-zinc-950/40">
        {game.results.map((r) => (
          <PublicGameResultLine key={r.playerId} result={r} />
        ))}
      </ul>
    </li>
  );
};
