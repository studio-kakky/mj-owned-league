import { Link } from '@tanstack/react-router';
import type { GroupHomeRoute, GroupHomeRouteSearch } from './GroupHomeSection';

export interface EmptyStateProps {
  testId: string;
  message: string;
  ctaLabel: string;
  ctaTo: GroupHomeRoute;
  ctaSearch: GroupHomeRouteSearch;
}

export const EmptyState = ({ testId, message, ctaLabel, ctaTo, ctaSearch }: EmptyStateProps) => {
  return (
    <div
      data-testid={testId}
      className="mx-5 rounded-lg border border-dashed border-[#262626] p-5 text-center"
    >
      <p className="text-[13px] text-[#888888]">{message}</p>
      <Link
        to={ctaTo}
        search={ctaSearch}
        className="mt-3 inline-block rounded-full bg-[#FAFAF8] px-4 py-1.5 text-xs font-semibold text-[#0E0E0E] transition-colors hover:bg-white"
      >
        {ctaLabel}
      </Link>
    </div>
  );
};
