import { Link } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import type { LeagueFormat } from '../../../db/schema';
import type { MatchDetailData } from '../detail-types';

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

export const MatchHeader = ({ data, origin }: { data: MatchDetailData; origin?: string }) => {
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
};
