/**
 * Bottom navigation for Owner-facing pages (mobile-first, 375pt baseline).
 *
 * Design source: `header_footer.jsx` (Claude Design handoff). Four primary
 * destinations, Heroicons outline glyphs, active tab in FG (#FAFAF8) and
 * inactive in DIM (#888):
 *   - ホーム   (the active Group's S6 dashboard, `/groups/$activeGroupId`)
 *   - リーグ   (the active Group's S15 list, `/groups/$activeGroupId/leagues`)
 *   - マッチ   (the active Group's S9 list, `/groups/$activeGroupId/matches`)
 *   - 設定     (`/settings`)
 *
 * ホーム / リーグ / マッチ are group-scoped (Issue #58 / #60 / #61): the nav
 * only renders once a Group has been entered, so "home" is that Group's
 * ダッシュボード, "リーグ" is that Group's League list, and "マッチ" is that
 * Group's Match list — not top-level routes. The caller passes the resolved
 * targets via {@link OwnerBottomNavProps.homeTo} /
 * {@link OwnerBottomNavProps.leaguesTo} / {@link OwnerBottomNavProps.matchesTo}.
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
  /**
   * Destination for the リーグ tab — the active Group's S15 League 一覧
   * (`/groups/$activeGroupId/leagues`). Same fallback rationale as
   * {@link OwnerBottomNavProps.homeTo}.
   */
  leaguesTo: string;
  /**
   * Destination for the マッチ tab — the active Group's S9 Match 一覧
   * (`/groups/$activeGroupId/matches`). Same fallback rationale as
   * {@link OwnerBottomNavProps.homeTo}.
   */
  matchesTo: string;
}

export const OwnerBottomNav = ({ homeTo, leaguesTo, matchesTo }: OwnerBottomNavProps) => {
  const navItems: ReadonlyArray<OwnerBottomNavItem> = [
    { label: 'ホーム', to: homeTo, exact: true, Icon: HomeIcon },
    { label: 'リーグ', to: leaguesTo, Icon: TrophyIcon },
    { label: 'マッチ', to: matchesTo, Icon: RectangleStackIcon },
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
