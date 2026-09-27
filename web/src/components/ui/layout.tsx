"use client";

/**
 * Заголовки страниц и разделов.
 */

import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, actions }: { eyebrow?: string; title: string; actions?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-4 pt-6 pb-4">
      <div>
        {eyebrow && <p className="text-secondary text-[13px] font-semibold tracking-wide uppercase first-letter:uppercase">{eyebrow}</p>}
        <h1 className="large-title">{title}</h1>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-8 mb-3 flex items-center justify-between">
      <h2 className="text-[20px] font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}
