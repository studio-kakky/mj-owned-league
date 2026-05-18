import type { LeagueFormat } from '../../../db/schema';
import type { PublicLeagueData } from '../types';

const FORMAT_LABELS: Readonly<Record<LeagueFormat, string>> = {
  '4P_HANCHAN': '4人 半荘',
  '4P_TONPU': '4人 東風',
  '3P_HANCHAN': '3人 半荘',
  '3P_TONPU': '3人 東風',
};

export const PublicLeagueHeader = ({ data }: { data: PublicLeagueData }) => {
  return (
    <header className="space-y-2" data-testid="public-league-header">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">League</p>
      <h1 className="text-2xl font-bold text-zinc-50">{data.name}</h1>
      <p className="text-sm text-zinc-400">
        {data.groupName} / {FORMAT_LABELS[data.format]}
      </p>
    </header>
  );
};
