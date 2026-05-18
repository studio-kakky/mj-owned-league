import { Link } from '@tanstack/react-router';

export type GroupHomeRoute = '/groups' | '/leagues' | '/matches';

export type GroupHomeRouteSearch =
  | undefined
  | { groupId: string }
  | { groupId: string; leagueId: string };

export interface GroupHomeSectionProps {
  title: string;
  moreLabel: string;
  moreTo: GroupHomeRoute;
  moreSearch: GroupHomeRouteSearch;
  testId: string;
  children: React.ReactNode;
}

export const GroupHomeSection = ({
  title,
  moreLabel,
  moreTo,
  moreSearch,
  testId,
  children,
}: GroupHomeSectionProps) => {
  return (
    <section className="space-y-3" data-testid={testId}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
        <Link
          to={moreTo}
          search={moreSearch}
          className="text-xs text-emerald-300 transition-colors hover:text-emerald-200"
          data-testid={`${testId}-more`}
        >
          {moreLabel} →
        </Link>
      </div>
      {children}
    </section>
  );
};
