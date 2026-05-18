import { Link } from '@tanstack/react-router';

export const PageHeader = ({ pendingInvitationCount }: { pendingInvitationCount: number }) => {
  return (
    <header className="space-y-2" data-testid="dashboard-header">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Dashboard</p>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">ホーム</h1>
          <p className="mt-1 text-sm text-zinc-400">直近の活動を俯瞰するハブです。</p>
        </div>
        <Link
          to="/invitations"
          data-testid="dashboard-invitations-pill"
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-emerald-500/70 hover:text-zinc-50"
        >
          <span>招待</span>
          <span
            data-testid="dashboard-invitations-count"
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-semibold leading-none text-zinc-950"
          >
            {pendingInvitationCount}
          </span>
        </Link>
      </div>
    </header>
  );
};
