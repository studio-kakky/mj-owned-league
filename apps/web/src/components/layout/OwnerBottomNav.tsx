/**
 * Bottom navigation for Owner-facing pages (mobile-first, 375pt baseline).
 *
 * Design source: `header_footer.jsx` (Claude Design handoff). Four primary
 * destinations, Heroicons outline glyphs, active tab in FG (#FAFAF8) and
 * inactive in DIM (#888):
 *   - ホーム   (the active Group's S6 dashboard, `/groups/$activeGroupId`)
 *   - リーグ   (`/leagues`)
 *   - マッチ   (`/matches`)
 *   - 設定     (`/settings`)
 *
 * ホーム is group-scoped (Issue #58): the nav only renders once a Group has
 * been entered, so its "home" is that Group's ダッシュボード — not the
 * top-level `/`, which merely redirects back to the group-selection screen.
 * The caller passes the resolved target via {@link OwnerBottomNavProps.homeTo}.
 *
 * The `to` props are typed as `string` (not the generated route literal
 * union) so the nav can link to routes that may not yet be mounted; until a
 * route lands TanStack Router falls back to the not-found handler, which is
 * the correct UX while those screens are still being built.
 */

import { Link } from '@tanstack/react-router';
import type { ComponentType } from 'react';
import { Cog6ToothIcon, HomeIcon, RectangleStackIcon, TrophyIcon } from './icons';

export interface OwnerBottomNavItem {
  label: string;
  /** Target route path. Free-form string — see file comment for rationale. */
  to: string;
  /** Match the active state exactly (no descendant routes light the tab up). */
  exact?: boolean;
  Icon: ComponentType<{ className?: string }>;
}

export interface OwnerBottomNavProps {
  /**
   * Destination for the ホーム tab — the active Group's S6 ダッシュボード
   * (`/groups/$activeGroupId`). Falls back to `/groups` (the selection screen)
   * when there is no active group, which should not happen while the nav is
   * visible but keeps the link safe.
   */
  homeTo: string;
}

export const OwnerBottomNav = ({ homeTo }: OwnerBottomNavProps) => {
  const navItems: ReadonlyArray<OwnerBottomNavItem> = [
    { label: 'ホーム', to: homeTo, exact: true, Icon: HomeIcon },
    { label: 'リーグ', to: '/leagues', Icon: TrophyIcon },
    { label: 'マッチ', to: '/matches', Icon: RectangleStackIcon },
    { label: '設定', to: '/settings', Icon: Cog6ToothIcon },
  ];

  return (
    <nav
      aria-label="メインナビゲーション"
      data-testid="owner-bottom-nav"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[#1F1F1F] bg-[#0E0E0E]"
    >
      <ul className="mx-auto flex max-w-3xl items-stretch justify-around px-2 pb-[max(18px,env(safe-area-inset-bottom))]">
        {navItems.map(({ label, to, exact, Icon }) => (
          <li key={label} className="flex-1">
            <Link
              to={to}
              activeOptions={{ exact: exact ?? false }}
              className="flex flex-col items-center justify-center gap-1 pt-2 pb-1.5 text-[11px] text-[#888888] transition-colors [&.active]:font-medium [&.active]:text-[#FAFAF8]"
              activeProps={{ className: 'active' }}
            >
              <Icon className="h-6 w-6" />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};
