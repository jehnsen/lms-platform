"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A modal dialog on the native `<dialog>` element, which traps focus, closes
 * on Escape and makes the page behind it inert (NFR-5).
 *
 * Render it only while it is open. Pages stay mounted when hidden, so the
 * component that opens it should also clear its "open" state in a
 * `useLayoutEffect` cleanup, or the dialog comes back with the page.
 */
export function Dialog({
  title,
  description,
  wide = false,
  onClose,
  children,
}: {
  title: string;
  description?: ReactNode;
  /** For media and long forms. */
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // A click that lands on the dialog element itself is a click on the backdrop.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/60",
        wide ? "max-w-3xl" : "max-w-lg",
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          {description ? <div className="mt-0.5 text-sm break-words text-ink-2">{description}</div> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-2 hover:bg-surface-2"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>
      <div className="max-h-[calc(100dvh-9rem)] overflow-y-auto px-5 py-4">{children}</div>
    </dialog>
  );
}
