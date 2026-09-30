"use client";

/**
 * Кнопка «‹ Раздел» вверху экрана. Если пришли прямо из этого раздела — работает как «Назад»
 * браузера: список открывается там же, где его оставили. Иначе (ссылка извне, новая вкладка) —
 * обычный переход в раздел.
 */

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cameFrom } from "./scroll-memory";
import { cx } from "./ui";

export function BackLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      className={cx("text-leaf inline-flex items-center gap-1", className)}
      onClick={(e) => {
        if (window.history.length > 1 && cameFrom(href)) {
          e.preventDefault();
          router.back();
        }
      }}
    >
      <ChevronLeft className="size-5" aria-hidden /> {children}
    </Link>
  );
}
