/**
 * Centered modal primitive used by the S16 Settings screen.
 *
 * This is a deliberate copy of `components/groups/Modal.tsx` rather than a
 * shared import: the two screens were built at different times and bundling
 * their modal primitives prematurely would couple unrelated change cadences.
 * If a third screen needs the same primitive we lift this into a shared
 * `components/ui/` slot.
 *
 * Accessibility / focus behaviour mirrors the groups version — see that file
 * for the rationale; the implementation is intentionally identical so the
 * two screens feel uniform on mobile.
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid={testId}>
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="relative w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
      >
        {children}
      </div>
    </div>
  );
};
