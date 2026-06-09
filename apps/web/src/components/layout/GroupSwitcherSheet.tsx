/**
 * Group switcher — a right-side drawer (design: `header_footer.jsx`
 * `SwitcherOverlay`). Lists the Owner's groups with the active one checked,
 * plus quick links (グループを管理 / 招待 / 設定), the signed-in user, and a
 * logout affordance.
 *
 * Implemented from scratch rather than pulling in shadcn/ui's Sheet: we only
 * need this one drawer in the MVP and Radix's Dialog + the registry would add
 * a large surface for a single use-case.
 *
 * Accessibility:
 *   - modal dialog (`role="dialog"` + `aria-modal="true"`).
 *   - backdrop closes on click; `Escape` closes via a keydown listener.
 *   - focus moves to the close button on open; the panel is `tabindex=-1`.
 *   - no full focus trap in MVP (short, flat content); revisit if it grows.
 */

import { Link } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import type { GroupSummary, OwnerSession } from './types';

export interface GroupSwitcherSheetProps {
  /** Whether the drawer is currently visible. */
  open: boolean;
  /** Close handler — called on backdrop click, Escape, or selection. */
  onClose: () => void;
  /**
   * Available groups. `null` means "we cannot list groups right now"
   * (typical: user is signed out). The drawer renders a disabled empty state
   * in that case rather than hiding outright, so the caller's "open" affordance
   * still feels consistent.
   */
  groups: ReadonlyArray<GroupSummary> | null;
  /** Currently active group id, or `null` if none. */
  activeGroupId: string | null;
  /** Called when the user picks a group. */
  onSelect: (groupId: string) => void;
  /** Signed-in Owner, shown in the drawer footer. Optional. */
  session?: OwnerSession | null;
  /** Logout handler. When omitted the logout row is not rendered. */
  onLogout?: () => void;
}

const DRAWER_LINE = '#3D3D3D';

export const GroupSwitcherSheet = ({
  open,
  onClose,
  groups,
  activeGroupId,
  onSelect,
  session,
  onLogout,
}: GroupSwitcherSheetProps) => {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const isDisabled = groups === null;

  return (
    <div className="fixed inset-0 z-50 font-sans" data-testid="group-switcher-sheet">
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="absolute inset-0 bg-black/55"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-switcher-title"
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-80 max-w-[85%] flex-col bg-[#303030] px-5 pt-11 pb-8"
        style={{ borderLeft: `1px solid ${DRAWER_LINE}` }}
      >
        <div className="flex items-center justify-between">
          <h2 id="group-switcher-title" className="text-[13px] text-[#888888]">
            グループ
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="閉じる"
            onClick={onClose}
            className="p-1 text-lg leading-none text-[#FAFAF8]"
          >
            ✕
          </button>
        </div>

        {isDisabled ? (
          <p className="mt-4 text-sm text-[#888888]" data-testid="group-switcher-disabled">
            ログインするとグループを切り替えできます。
          </p>
        ) : groups.length === 0 ? (
          <p className="mt-4 text-sm text-[#888888]">所属しているグループがまだありません。</p>
        ) : (
          <div className="mt-4 flex flex-col" data-testid="group-switcher-list">
            {groups.map((group) => {
              const isActive = group.id === activeGroupId;
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => {
                    onSelect(group.id);
                    onClose();
                  }}
                  aria-pressed={isActive}
                  className="flex items-center justify-between px-1 py-3.5 text-left"
                  style={{ borderBottom: `1px solid ${DRAWER_LINE}` }}
                >
                  <span
                    className={`text-[15px] text-[#FAFAF8] ${isActive ? 'font-semibold' : 'font-normal'}`}
                  >
                    {group.name}
                  </span>
                  {isActive ? <span className="text-sm text-[#FAFAF8]">✓</span> : null}
                </button>
              );
            })}
          </div>
        )}

        <Link
          to="/groups"
          onClick={onClose}
          className="mt-4 flex h-11 items-center justify-between px-1 text-sm text-[#FAFAF8]"
        >
          <span>グループを管理</span>
          <span className="text-sm text-[#888888]">→</span>
        </Link>

        <div className="flex-1" />

        <div className="flex flex-col pt-3" style={{ borderTop: `1px solid ${DRAWER_LINE}` }}>
          <Link to="/invitations" onClick={onClose} className="px-1 py-3 text-sm text-[#FAFAF8]">
            招待
          </Link>
          <Link to="/settings" onClick={onClose} className="px-1 py-3 text-sm text-[#FAFAF8]">
            設定
          </Link>
        </div>

        {session ? (
          <div
            className="mt-2 flex items-center gap-3 pt-3"
            style={{ borderTop: `1px solid ${DRAWER_LINE}` }}
          >
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1A1A1A] text-xs font-medium text-[#FAFAF8]"
              style={{ border: `1px solid ${DRAWER_LINE}` }}
            >
              {session.displayName.trim().charAt(0) || '?'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-[#FAFAF8]">
                {session.displayName}
              </div>
            </div>
          </div>
        ) : null}

        {onLogout ? (
          <button
            type="button"
            onClick={onLogout}
            className="mt-2 h-8 px-0 text-left text-xs text-[#888888]"
          >
            ログアウト
          </button>
        ) : null}
      </div>
    </div>
  );
};
