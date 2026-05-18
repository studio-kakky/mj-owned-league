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
      className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-5 text-center"
    >
      <p className="text-sm text-zinc-300">{message}</p>
      <Link
        to={ctaTo}
        search={ctaSearch}
        className="mt-3 inline-block rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
      >
        {ctaLabel}
      </Link>
    </div>
  );
};
