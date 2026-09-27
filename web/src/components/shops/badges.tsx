"use client";

/** Значки магазина: статус заявки, отметка «проверен», ссылка на витрину и цена. */

import { BadgeCheck } from "lucide-react";
import { cx } from "@/components/ui";
import { SHOP_STATUS, type ShopStatus } from "@/lib/domain/shop";

export const shopHref = (id: string) => `/shop/?id=${encodeURIComponent(id)}`;

const STATUS_TONE: Record<ShopStatus, string> = {
  pending: "bg-soil/15 text-soil",
  verified: "bg-leaf/15 text-leaf",
  rejected: "bg-alert/15 text-alert",
  suspended: "bg-muted text-secondary",
};

export function ShopStatusPill({ status }: { status: ShopStatus }) {
  return (
    <span className={cx("inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-semibold", STATUS_TONE[status])}>
      {SHOP_STATUS[status]}
    </span>
  );
}

/** Значок проверенного магазина. */
export function VerifiedMark({ className }: { className?: string }) {
  return <BadgeCheck className={cx("text-leaf inline size-[1em] shrink-0", className)} aria-label="Проверенный магазин" />;
}

export const priceText = (rub: number | null) => (rub == null ? "Цена по запросу" : `${rub.toLocaleString("ru-RU")} ₽`);
