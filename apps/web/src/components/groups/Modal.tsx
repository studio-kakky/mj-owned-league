/**
 * Lightweight centered modal primitive used by the S4-S5 group screens.
 *
 * Similar in spirit to `GroupSwitcherSheet` (Issue #11), but the layout is
 * a centered card rather than a bottom sheet — Group 作成 / 編集 / 削除確認
 * are short forms, not navigation actions, so the bottom-sheet shape would
 * read as "switcher" rather than "form / confirmation".
 *
 * Accessibility:
 *   - Renders nothing when `open` is false (no role/aria flicker on close).
 *   - `role="dialog"` + `aria-modal="true"`, with a caller-supplied
 *     `aria-labelledby` pointing at the title element rendered inside
 *     `children`.
 *   - Backdrop click + Escape both call `onClose`. Same focus-trap caveat
 *     as `GroupSwitcherSheet`: we move focus to the close affordance on
 *     open but do not cycle-trap it. For a single short form this is
 *     acceptable; revisit if forms grow.
 *
 * The primitive deliberately does NOT own its own header / close button so
 * each consuming modal can wire its own primary action and label. The
 * caller is responsible for rendering an `<h2 id="...">` matching
 * `labelledBy`.
 */

import { type ReactNode, useEffect, useRef } from 'react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Element id of the title rendered inside `children`. */
  labelledBy: string;
  /** Extra `data-testid` on the dialog body — useful for unit tests. */
  testId?: string;
  children: ReactNode;
}

export const Modal = ({ open, onClose, labelledBy, testId, children }: ModalProps) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    // Move focus to the dialog body so screen readers anchor here and the
    // page beneath does not retain the previously-focused element. Skipped
    // when there is no DOM (SSR).
    dialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 font-sans" data-testid={testId}>
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="absolute inset-0 bg-black/55"
      />
      {/* Top-anchored full-width sheet (design: `groups.jsx` FullScreenModal).
          Centred within the mobile column so it tracks the app's max width. */}
      <div className="absolute inset-x-0 top-0 mx-auto flex max-h-full max-w-3xl flex-col">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          tabIndex={-1}
          className="flex max-h-full flex-col overflow-hidden bg-[#141414]"
        >
          {children}
        </div>
      </div>
    </div>
  );
};
