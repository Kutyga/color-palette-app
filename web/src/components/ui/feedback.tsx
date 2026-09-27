"use client";

/**
 * Состояния экрана: пусто, загрузка, ошибка.
 */

import { Loader2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./controls";

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon: LucideIcon;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="bg-muted mb-4 grid size-20 place-items-center rounded-full">
        <Icon className="text-leaf size-9" strokeWidth={1.6} aria-hidden />
      </div>
      <h2 className="text-[20px] font-semibold">{title}</h2>
      {message && <p className="text-secondary mt-2 max-w-sm text-[15px]">{message}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Spinner({ label = "Загрузка…" }: { label?: string }) {
  return (
    <div className="text-secondary grid place-items-center py-16" role="status">
      <Loader2 className="size-7 animate-spin" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="bg-surface mx-auto my-10 max-w-md rounded-[20px] p-6 text-center" role="alert">
      <p className="font-semibold">Не удалось загрузить</p>
      <p className="text-secondary mt-1 text-[15px]">{error instanceof Error ? error.message : String(error)}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Повторить
        </Button>
      )}
    </div>
  );
}
