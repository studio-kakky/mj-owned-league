/**
 * Owner-facing layout shell.
 *
 * Combines `OwnerHeader` (top bar with group-switcher trigger), the page
 * content, the `OwnerBottomNav` (4-tab nav), and the `GroupSwitcherSheet`
 * modal. Tracks the sheet open/close state internally — callers should not
 * have to wire that up themselves.
 *
 * Authentication-aware behavior:
 *   - `session === null` → guest mode. Header still renders, but the
 *     group-switcher trigger is disabled and the sheet shows a guidance
 *     copy ("ログインするとグループを切り替えできます").
 *   - `session !== null` → the trigger opens the sheet, which lists `groups`.
 *
 * The shell takes the group-selection callback as a prop so the active group
 * lives outside the layout (in a route loader, server-action result, etc.).
 * That keeps the layout pure-presentational and trivial to unit-test.
 */

import { type ReactNode, useState } from 'react';
import { signOut } from '../../auth/client';
import { GroupSwitcherSheet } from './GroupSwitcherSheet';
import { OwnerBottomNav } from './OwnerBottomNav';
import { OwnerHeader } from './OwnerHeader';
import type { GroupSummary, OwnerSession } from './types';

export interface OwnerShellProps {
  /** The signed-in Owner, or `null` for guest renders. */
  session: OwnerSession | null;
  /** Currently active group, or `null` if none selected / not signed in. */
  activeGroup: GroupSummary | null;
  /**
   * Full list of groups the current Owner can switch to. Pass `null` when the
   * user is not signed in — the sheet will render a disabled guidance message
   * instead of an empty list.
   */
  groups: ReadonlyArray<GroupSummary> | null;
  /** Called when the user picks a group from the sheet. */
  onSelectGroup: (groupId: string) => void;
  /**
   * Whether to render the 4-tab bottom nav. The nav links to group-scoped
   * destinations (ホーム / リーグ / マッチ / 設定), so it is hidden on the
   * group-selection screen (`/groups`) — where no group is active yet — and
   * shown once the user has entered a group. Defaults to `true`.
   */
  showBottomNav?: boolean;
  children: ReactNode;
}

export const OwnerShell = ({
  session,
  activeGroup,
  groups,
  onSelectGroup,
  showBottomNav = true,
  children,
}: OwnerShellProps) => {
  const [isSheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0E0E0E] font-sans text-[#FAFAF8]">
      <OwnerHeader
        session={session}
        activeGroup={activeGroup}
        onOpenGroupSwitcher={() => setSheetOpen(true)}
      />

      {/* Reserve clearance for the fixed bottom nav only when it is shown;
          the selection screen drops it back to a normal bottom gap.
          Horizontal padding is owned here for legacy screens (S3); the
          redesigned full-bleed screens (S4 一覧 / S6 グループホーム) break out
          with `-mx-4`. */}
      <main className={`mx-auto max-w-3xl px-4 pt-4 ${showBottomNav ? 'pb-24' : 'pb-8'}`}>
        {children}
      </main>

      {showBottomNav ? (
        <OwnerBottomNav
          homeTo={activeGroup ? `/groups/${activeGroup.id}` : '/groups'}
          leaguesTo={activeGroup ? `/groups/${activeGroup.id}/leagues` : '/groups'}
          matchesTo={activeGroup ? `/groups/${activeGroup.id}/matches` : '/groups'}
        />
      ) : null}

      <GroupSwitcherSheet
        open={isSheetOpen}
        onClose={() => setSheetOpen(false)}
        groups={groups}
        activeGroupId={activeGroup?.id ?? null}
        onSelect={onSelectGroup}
        session={session}
        onLogout={
          session
            ? () => {
                // Fire-and-forget: clear the Better Auth session, then hard
                // navigate to the login screen. A full reload (rather than a
                // router navigation) guarantees no stale Owner state lingers.
                void signOut().finally(() => {
                  if (typeof window !== 'undefined') window.location.assign('/login');
                });
              }
            : undefined
        }
      />
    </div>
  );
};
