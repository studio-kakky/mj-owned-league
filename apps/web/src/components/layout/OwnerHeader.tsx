/**
 * Top bar for Owner-facing pages.
 *
 * Contains:
 *  - The JANROKU wordmark (links to `/`).
 *  - The active-group selector trigger (opens the GroupSwitcherSheet via
 *    the prop callback). When the user is not signed in we render the
 *    trigger as disabled so the visual rhythm of the header is preserved
 *    even on guest views (S1 redirect, mid-auth states, etc.).
 */

import { Link } from '@tanstack/react-router';
import type { GroupSummary, OwnerSession } from './types';

export interface OwnerHeaderProps {
  session: OwnerSession | null;
  activeGroup: GroupSummary | null;
  onOpenGroupSwitcher: () => void;
}

export function OwnerHeader({ session, activeGroup, onOpenGroupSwitcher }: OwnerHeaderProps) {
  const isAuthenticated = session !== null;

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-900 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
        <Link to="/" className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-100">
          JANROKU
        </Link>

        <button
          type="button"
          onClick={onOpenGroupSwitcher}
          disabled={!isAuthenticated}
          aria-haspopup="dialog"
          aria-label="グループ切替"
          data-testid="owner-header-group-trigger"
          className="flex max-w-[55%] items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="truncate">
            {activeGroup ? activeGroup.name : isAuthenticated ? 'グループ未選択' : 'ゲスト'}
          </span>
          <span aria-hidden="true" className="text-zinc-500">
            ▾
          </span>
        </button>
      </div>
    </header>
  );
}
