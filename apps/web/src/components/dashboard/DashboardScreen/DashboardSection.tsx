import { Link } from '@tanstack/react-router';

export type DashboardRoute = '/groups' | '/leagues' | '/matches' | '/invitations';

export interface DashboardSectionProps {
  title: string;
  moreLabel: string;
  moreTo: DashboardRoute;
  testId: string;
  children: React.ReactNode;
}

export const DashboardSection = ({
  title,
  moreLabel,
  moreTo,
  testId,
  children,
}: DashboardSectionProps) => {
  return (
    <section className="space-y-3" data-testid={testId}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
        <Link
          to={moreTo}
          className="text-xs text-emerald-300 transition-colors hover:text-emerald-200"
        >
          {moreLabel} →
        </Link>
      </div>
      {children}
    </section>
  );
};
