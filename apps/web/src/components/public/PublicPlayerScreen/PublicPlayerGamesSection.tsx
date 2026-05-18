import { Link } from '@tanstack/react-router';
import type { TobiRole } from '../../../db/schema';
import type { PublicPlayerGameRow } from '../types';

const TOBI_LABEL: Readonly<Record<TobiRole, string>> = {
  INFLICTOR: '飛ばした',
  VICTIM: '飛んだ',
};

const formatDate = (iso: string): string => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
};

const formatPointsSigned = (value: number): string => {
  const formatted = value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return value > 0 ? `+${formatted}` : formatted;
};

export const PublicPlayerGamesSection = ({
  games,
  publicSlug,
}: {
  games: ReadonlyArray<PublicPlayerGameRow>;
  publicSlug: string;
}) => {
  return (
    <section className="space-y-3" data-testid="public-player-games-section">
      <h2 className="text-sm font-semibold text-zinc-200">対局履歴</h2>
      {games.length === 0 ? (
        <p
          data-testid="public-player-games-empty"
          className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-5 text-center text-xs text-zinc-400"
        >
          このプレイヤーの対局はまだありません。
        </p>
      ) : (
        <ul className="space-y-2" data-testid="public-player-games-list">
          {games.map((game) => (
            <li
              key={game.gameId}
              data-testid={`public-player-game-row-${game.gameId}`}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <Link
                  to="/l/$publicSlug/matches/$sequenceNumber"
                  params={{ publicSlug, sequenceNumber: String(game.matchSequenceNumber) }}
                  className="truncate text-emerald-300 underline-offset-2 hover:underline"
                >
                  第 {game.matchSequenceNumber} 節 {game.matchName}
                </Link>
                <time className="shrink-0 text-zinc-500" dateTime={game.playedAt}>
                  {formatDate(game.playedAt)}
                </time>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-zinc-200">
                <span className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-300">
                    {game.rank}
                  </span>
                  {game.tobiRole !== null ? (
                    <span className="rounded-full bg-amber-900/40 px-2 py-0.5 text-[10px] text-amber-200">
                      {TOBI_LABEL[game.tobiRole]}
                    </span>
                  ) : null}
                </span>
                <span className="font-mono text-zinc-400">
                  {game.rawScore.toLocaleString()}
                  <span className="ml-2 text-emerald-300">{formatPointsSigned(game.points)}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
