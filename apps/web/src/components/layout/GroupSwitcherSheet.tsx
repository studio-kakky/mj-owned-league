/**
 * Bottom sheet for switching the active Group.
 *
 * Implemented from scratch instead of pulling in `shadcn/ui`'s `Sheet`
 * primitive: we only need ONE bottom sheet in the MVP and bringing in
 * Radix's Dialog + the shadcn registry would add a large surface area for
 * a single use-case. If a second sheet/dialog lands, we revisit.
 *
 * Accessibility notes:
 *   - The sheet is a modal dialog (`role="dialog"` + `aria-modal="true"`).
 *   - The backdrop closes the sheet on click.
 *   - `Escape` closes the sheet via a `keydown` listener.
 *   - Focus is moved to the first focusable element on open (the close button)
 *     and a `tabindex="-1"` is applied to the panel so screen readers anchor.
 *   - We do not implement a full focus trap in MVP. The sheet contains a
 *     short, flat list; tab-cycling out of it returns to background controls
 *     which is acceptable for this UI. Revisit if the contents grow.
 */

import { useEffect, useRef } from 'react';
import type { GroupSummary } from './types';

export interface GroupSwitcherSheetProps {
  /** Whether the sheet is currently visible. */
  open: boolean;
  /** Close handler — called on backdrop click, Escape, or selection. */
  onClose: () => void;
  /**
   * Available groups. `null` means "we cannot list groups right now"
   * (typical: user is signed out). The sheet renders a disabled empty state
   * in that case rather than hiding the sheet outright, so the caller's
   * "open this sheet" affordance still feels consistent.
   */
  groups: ReadonlyArray<GroupSummary> | null;
  /** Currently active group id, or `null` if none. */
  activeGroupId: string | null;
  /** Called when the user picks a group. */
  onSelect: (groupId: string) => void;
}

export const GroupSwitcherSheet = ({
  open,
  onClose,
  groups,
  activeGroupId,
  onSelect,
}: GroupSwitcherSheetProps) => {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    // Move focus to the close button so keyboard / screen-reader users land
    // somewhere sensible. Skipped when there is no DOM yet (SSR).
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const isDisabled = groups === null;

  return (
    <div className="fixed inset-0 z-50" data-testid="group-switcher-sheet">
      {/* Backdrop. Using button for an accessible click target with Escape. */}
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-switcher-title"
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-zinc-800 bg-zinc-950 p-5 pb-8 shadow-2xl"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-zinc-700" aria-hidden="true" />
        <div className="flex items-center justify-between">
          <h2 id="group-switcher-title" className="text-base font-semibold text-zinc-100">
            グループを切り替え
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
          >
            閉じる
          </button>
        </div>

        {isDisabled ? (
          <p className="mt-4 text-sm text-zinc-500" data-testid="group-switcher-disabled">
            ログインするとグループを切り替えできます。
          </p>
        ) : groups.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">所属しているグループがまだありません。</p>
        ) : (
          <ul className="mt-4 space-y-1" data-testid="group-switcher-list">
            {groups.map((group) => {
              const isActive = group.id === activeGroupId;
              return (
                <li key={group.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(group.id);
                      onClose();
                    }}
                    aria-pressed={isActive}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm transition-colors ${
                      isActive
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'text-zinc-200 hover:bg-zinc-900'
                    }`}
                  >
                    <span>{group.name}</span>
                    {isActive && (
                      <span className="text-xs uppercase tracking-widest text-emerald-400">
                        active
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
