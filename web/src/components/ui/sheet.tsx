"use client";

/**
 * Модальное окно-лист.
 */

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/** Модальное окно: снизу на телефоне (как лист iOS), по центру на компьютере. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className="bg-surface text-label m-0 mt-auto w-full max-w-none rounded-t-[28px] p-0 backdrop:bg-black/40 backdrop:backdrop-blur-sm sm:m-auto sm:max-w-lg sm:rounded-[28px]"
    >
      {open && (
        <div className="animate-slide-up flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h2 className="text-[20px] font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="bg-muted grid size-9 place-items-center rounded-full" aria-label="Закрыть">
              <X className="size-4" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 pb-6">{children}</div>
        </div>
      )}
    </dialog>
  );
}
