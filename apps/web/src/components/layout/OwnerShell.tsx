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
  children: ReactNode;
}

export const OwnerShell = ({
  session,
  activeGroup,
  groups,
  onSelectGroup,
  children,
}: OwnerShellProps) => {
  const [isSheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <OwnerHeader
        session={session}
        activeGroup={activeGroup}
        onOpenGroupSwitcher={() => setSheetOpen(true)}
      />

      {/* Reserve space for the fixed bottom nav (h-14 + safe-area). */}
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-4">{children}</main>

      <OwnerBottomNav />

      <GroupSwitcherSheet
        open={isSheetOpen}
        onClose={() => setSheetOpen(false)}
        groups={groups}
        activeGroupId={activeGroup?.id ?? null}
        onSelect={onSelectGroup}
      />
    </div>
  );
};
