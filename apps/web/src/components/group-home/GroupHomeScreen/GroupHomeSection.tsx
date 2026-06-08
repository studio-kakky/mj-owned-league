import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

export type GroupHomeRoute = '/groups' | '/leagues' | '/matches';

export type GroupHomeRouteSearch =
  | undefined
  | { groupId: string }
  | { groupId: string; leagueId: string };

/**
 * Right-pointing chevron used on section "もっと見る" links and list rows
 * (design: `group-home.jsx` ChevronRight).
 */
export const ChevronRight = ({ size = 14, className }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <title>開く</title>
    <path d="M5 3 L9 7 L5 11" />
  </svg>
);

/**
 * Full-bleed list row with hairline separators (design: `group-home.jsx`
 * Row). The last row gets a bottom border via the `[&:last-child]` selector.
 */
export const Row = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div
    className={`flex items-center justify-between gap-3 border-t border-[#1F1F1F] px-5 py-3.5 [&:last-child]:border-b ${className ?? ''}`}
  >
    {children}
  </div>
);

export interface GroupHomeSectionProps {
  title: string;
  /** Optional mono count shown next to the title (e.g. "3 / 5"). */
  count?: string;
  moreLabel: string;
  moreTo: GroupHomeRoute;
  moreSearch: GroupHomeRouteSearch;
  testId: string;
  children: ReactNode;
}

export const GroupHomeSection = ({
  title,
  count,
  moreLabel,
  moreTo,
  moreSearch,
  testId,
  children,
}: GroupHomeSectionProps) => {
  return (
    <section className="mt-7" data-testid={testId}>
      <div className="mb-2.5 flex items-baseline justify-between px-5">
        <div className="flex items-baseline gap-2.5">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[#888888]">
            {title}
          </span>
          {count != null ? (
            <span className="font-mono text-[11px] text-[#666666]">{count}</span>
          ) : null}
        </div>
        <Link
          to={moreTo}
          search={moreSearch}
          className="flex items-center gap-1 text-xs text-[#888888] transition-colors hover:text-[#FAFAF8]"
          data-testid={`${testId}-more`}
        >
          <span>{moreLabel}</span>
          <ChevronRight size={11} />
        </Link>
      </div>
      {children}
    </section>
  );
};
