/**
 * Bottom navigation for Owner-facing pages (mobile-first, 375pt baseline).
 *
 * Four primary destinations, matching the acceptance criterion on Issue #11:
 *   - ホーム   (`/`)
 *   - リーグ   (`/leagues`)
 *   - マッチ   (`/matches`)
 *   - 設定     (`/settings`)
 *
 * The League / Match / Settings landing pages are tracked under their own
 * issues (S6 / S9 / S16). For now the bottom nav simply links to those
 * paths; until the routes are mounted, TanStack Router will fall back to
 * the not-found handler — which is the correct UX while those screens are
 * still being built. The `to` props are typed as `string` (rather than the
 * generated route literal union) to allow linking to routes that have not
 * yet been added to the route tree.
 */

import { Link } from '@tanstack/react-router';

export interface OwnerBottomNavItem {
  label: string;
  /** Target route path. Free-form string — see file comment for rationale. */
  to: string;
}

const NAV_ITEMS: ReadonlyArray<OwnerBottomNavItem> = [
  { label: 'ホーム', to: '/' },
  { label: 'リーグ', to: '/leagues' },
  { label: 'マッチ', to: '/matches' },
  { label: '設定', to: '/settings' },
];

/**
 * Inline glyph placeholders. We avoid pulling in an icon library for the
 * shell scaffold; once the icon system is decided (Issue TBD) replace these
 * with real SVG components.
 */
const iconFor = (label: string): string => {
  switch (label) {
    case 'ホーム':
      return '⌂';
    case 'リーグ':
      return '◇';
    case 'マッチ':
      return '◷';
    case '設定':
      return '⚙';
    default:
      return '•';
  }
};

export const OwnerBottomNav = () => {
  return (
    <nav
      aria-label="メインナビゲーション"
      data-testid="owner-bottom-nav"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-900 bg-zinc-950/95 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-3xl items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.map((item) => (
          <li key={item.to} className="flex-1">
            <Link
              to={item.to}
              activeOptions={{ exact: item.to === '/' }}
              className="flex h-14 flex-col items-center justify-center gap-0.5 text-xs text-zinc-400 transition-colors hover:text-zinc-100 [&.active]:text-emerald-400"
              activeProps={{ className: 'active' }}
            >
              <span aria-hidden="true" className="text-base leading-none">
                {iconFor(item.label)}
              </span>
              <span>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};
