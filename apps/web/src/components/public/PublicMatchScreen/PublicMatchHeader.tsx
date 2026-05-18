import { Link } from '@tanstack/react-router';
import type { LeagueFormat } from '../../../db/schema';
import type { PublicMatchData } from '../types';

const FORMAT_LABELS: Readonly<Record<LeagueFormat, string>> = {
  '4P_HANCHAN': '4人 半荘',
  '4P_TONPU': '4人 東風',
  '3P_HANCHAN': '3人 半荘',
  '3P_TONPU': '3人 東風',
};

const formatDate = (iso: string): string => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
};

export const PublicMatchHeader = ({ data }: { data: PublicMatchData }) => {
  return (
    <header className="space-y-3" data-testid="public-match-header">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Match</p>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-zinc-50">
          {data.sequenceNumber !== null ? `第 ${data.sequenceNumber} 節 ` : ''}
          {data.name}
        </h1>
        <p className="truncate text-sm text-zinc-400">
          {data.groupName}
          {data.leagueName !== null && data.leaguePublicSlug !== null ? (
            <>
              {' / '}
              <Link
                to="/l/$publicSlug"
                params={{ publicSlug: data.leaguePublicSlug }}
                className="text-emerald-300 underline-offset-2 hover:underline"
              >
                {data.leagueName}
              </Link>
            </>
          ) : null}
          {' / '}
          {FORMAT_LABELS[data.format]}
        </p>
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
    </header>
  );
};
