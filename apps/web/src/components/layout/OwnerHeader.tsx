/**
 * Top bar for Owner-facing pages.
 *
 * Design source: `header_footer.jsx` (Claude Design handoff). Dark chrome —
 * JANROKU mono wordmark on the left (links to `/`), active-group selector on
 * the right (group name + caret) that opens the GroupSwitcherSheet.
 *
 * When the user is not signed in the trigger renders disabled so the header's
 * visual rhythm is preserved on guest views (S1 redirect / mid-auth states).
 */

import { Link } from '@tanstack/react-router';
import { CaretDownIcon } from './icons';
import type { GroupSummary, OwnerSession } from './types';

export interface OwnerHeaderProps {
  session: OwnerSession | null;
  activeGroup: GroupSummary | null;
  onOpenGroupSwitcher: () => void;
}

export const OwnerHeader = ({ session, activeGroup, onOpenGroupSwitcher }: OwnerHeaderProps) => {
  const isAuthenticated = session !== null;

  return (
    <header className="sticky top-0 z-30 border-b border-[#1F1F1F] bg-[#0E0E0E]">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-2.5">
        <Link
          to="/"
          className="px-2 font-mono text-[13px] font-medium tracking-[0.24em] text-[#FAFAF8]"
        >
          JANROKU
        </Link>

        <button
          type="button"
          onClick={onOpenGroupSwitcher}
          disabled={!isAuthenticated}
          aria-haspopup="dialog"
          aria-label="グループ切替"
          data-testid="owner-header-group-trigger"
          className="flex max-w-[55%] items-center gap-2 px-2 py-1.5 text-[#FAFAF8] transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="truncate text-sm font-medium">
            {activeGroup ? activeGroup.name : isAuthenticated ? 'グループ未選択' : 'ゲスト'}
          </span>
          <CaretDownIcon className="shrink-0 text-[#888888]" />
        </button>
      </div>
    </header>
  );
};
