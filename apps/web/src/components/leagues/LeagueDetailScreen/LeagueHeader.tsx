import { useState } from 'react';
import type { LeagueFormat } from '../../../db/schema';
import type { LeagueDetailData } from '../types';

const FORMAT_LABELS: Readonly<Record<LeagueFormat, string>> = {
  '4P_HANCHAN': '4人 半荘',
  '4P_TONPU': '4人 東風',
  '3P_HANCHAN': '3人 半荘',
  '3P_TONPU': '3人 東風',
};

export const LeagueHeader = ({ data, origin }: { data: LeagueDetailData; origin?: string }) => {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  const publicPath = `/l/${data.publicSlug}`;
  // Prefer the explicit prop; fall back to the browser's runtime origin so
  // the copied URL is absolute. In SSR we get the empty string — the button
  // is still safe to render; clicking it copies the relative path.
  const publicUrl =
    (origin ?? (typeof window === 'undefined' ? '' : window.location.origin)) + publicPath;

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(publicUrl);
      } else {
        // Fallback path — see file-level comment for why this exists. We use
        // `document.execCommand('copy')` deliberately; modern lint rules flag
        // it as deprecated, but the only call site is the no-clipboard
        // fallback and `navigator.clipboard` is the happy path.
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
  };

  return (
    <header className="space-y-3" data-testid="league-detail-header">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">League</p>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">{data.name}</h1>
          <p className="mt-1 truncate text-sm text-zinc-400">
            {data.groupName} / {FORMAT_LABELS[data.format]}
          </p>
        </div>
        <span
          data-testid="league-detail-status"
          className="inline-flex shrink-0 items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200"
        >
          {data.status === 'ACTIVE' ? '進行中' : '終了'}
        </span>
      </div>

      <div
        data-testid="league-detail-public-url"
        className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3"
      >
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">公開 URL</p>
          <p className="mt-1 truncate text-xs text-zinc-300">{publicUrl || publicPath}</p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          data-testid="league-detail-public-url-copy"
          className="shrink-0 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
        >
          {copyState === 'copied' ? 'コピーしました' : copyState === 'error' ? '失敗' : 'コピー'}
        </button>
      </div>
    </header>
  );
};
