import type { LeagueGameRow } from '../types';
import { formatDate } from './formatDate';

export const RecentGamesSection = ({ games }: { games: ReadonlyArray<LeagueGameRow> }) => {
  return (
    <section className="space-y-3" data-testid="league-detail-games-section">
      <h2 className="text-sm font-semibold text-zinc-200">直近の対局</h2>
      {games.length === 0 ? (
        <p
          data-testid="league-detail-games-empty"
          className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-5 text-center text-xs text-zinc-400"
        >
          まだ対局がありません。
        </p>
      ) : (
        <ul className="space-y-2" data-testid="league-detail-games-list">
          {games.map((game) => (
            <li
              key={game.id}
              data-testid={`league-detail-game-row-${game.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3"
            >
              <p className="min-w-0 truncate text-sm text-zinc-200">
                {game.matchName ?? 'カジュアル対局'}
              </p>
              <time className="shrink-0 text-xs text-zinc-500" dateTime={game.playedAt}>
                {formatDate(game.playedAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
