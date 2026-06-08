/**
 * Bottom navigation for Owner-facing pages (mobile-first, 375pt baseline).
 *
 * Design source: `header_footer.jsx` (Claude Design handoff). Four primary
 * destinations, Heroicons outline glyphs, active tab in FG (#FAFAF8) and
 * inactive in DIM (#888):
 *   - ホーム   (`/`)
 *   - リーグ   (`/leagues`)
 *   - マッチ   (`/matches`)
 *   - 設定     (`/settings`)
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
  Icon: ComponentType<{ className?: string }>;
}

const NAV_ITEMS: ReadonlyArray<OwnerBottomNavItem> = [
  { label: 'ホーム', to: '/', Icon: HomeIcon },
  { label: 'リーグ', to: '/leagues', Icon: TrophyIcon },
  { label: 'マッチ', to: '/matches', Icon: RectangleStackIcon },
  { label: '設定', to: '/settings', Icon: Cog6ToothIcon },
];

export const OwnerBottomNav = () => {
  return (
    <nav
      aria-label="メインナビゲーション"
      data-testid="owner-bottom-nav"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[#1F1F1F] bg-[#0E0E0E]"
    >
      <ul className="mx-auto flex max-w-3xl items-stretch justify-around px-2 pb-[max(18px,env(safe-area-inset-bottom))]">
        {NAV_ITEMS.map(({ label, to, Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              activeOptions={{ exact: to === '/' }}
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
