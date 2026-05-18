import { Link } from '@tanstack/react-router';
import type { PublicPlayerData } from '../types';

export const PublicPlayerHeader = ({ data }: { data: PublicPlayerData }) => {
  return (
    <header className="space-y-2" data-testid="public-player-header">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Player</p>
      <h1 className="text-2xl font-bold text-zinc-50">{data.playerName}</h1>
      <p className="text-sm text-zinc-400">
        <Link
          to="/l/$publicSlug"
          params={{ publicSlug: data.leaguePublicSlug }}
          className="text-emerald-300 underline-offset-2 hover:underline"
        >
          {data.leagueName}
        </Link>
      </p>
    </header>
  );
};
