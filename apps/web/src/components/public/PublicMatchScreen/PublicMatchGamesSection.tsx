import type { PublicMatchGameRow as PublicMatchGameRowData } from '../types';
import { PublicGameRow } from './PublicGameRow';

export const PublicMatchGamesSection = ({
  games,
}: {
  games: ReadonlyArray<PublicMatchGameRowData>;
}) => {
  return (
    <section className="space-y-3" data-testid="public-match-games-section">
      <h2 className="text-sm font-semibold text-zinc-200">対局一覧</h2>
      {games.length === 0 ? (
        <p
          data-testid="public-match-games-empty"
          className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-5 text-center text-xs text-zinc-400"
        >
          まだ対局がありません。
        </p>
      ) : (
        <ul className="space-y-3" data-testid="public-match-games-list">
          {games.map((game) => (
            <PublicGameRow key={game.id} game={game} />
          ))}
        </ul>
      )}
    </section>
  );
};
