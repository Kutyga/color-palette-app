"use client";

/** Карточка «Мой магазин» в профиле: статус заявки, переход в кабинет, очередь проверки для администратора. */

import { ChevronRight, ShieldCheck, Store } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui";
import { useMyShop, useProfile, useReviewQueue } from "@/lib/queries";
import { ShopStatusPill } from "./badges";

/** Карточка в профиле: свой магазин, а у администратора — ещё и заявки на проверку. */
export function ProfileShopCard() {
  const shop = useMyShop();
  const profile = useProfile();
  const isAdmin = profile.data?.isAdmin ?? false;
  const queue = useReviewQueue(isAdmin);
  const pending = queue.data?.filter((s) => s.status === "pending").length ?? 0;
  return (
    <Card className="divide-separator divide-y">
      <Link href="/shop/manage/" className="flex items-center gap-4 p-5">
        <Store className="text-leaf size-6" aria-hidden />
        <span className="min-w-0 flex-1">
          {shop.data ? (
            <>
              <span className="flex flex-wrap items-center gap-2 font-semibold">
                <span className="truncate">{shop.data.name}</span> <ShopStatusPill status={shop.data.status} />
              </span>
              <span className="text-secondary block text-[15px]">Витрина, каталог и цены</span>
            </>
          ) : (
            <>
              <span className="block font-semibold">Вы продаёте растения?</span>
              <span className="text-secondary block text-[15px]">Откройте магазин — бесплатно</span>
            </>
          )}
        </span>
        <ChevronRight className="text-secondary size-5" aria-hidden />
      </Link>
      {isAdmin && (
        <Link href="/admin/shops/" className="flex items-center gap-4 p-5">
          <ShieldCheck className="text-soil size-6" aria-hidden />
          <span className="flex-1 font-semibold">Проверка магазинов</span>
          {pending > 0 && (
            <span
              className="bg-alert grid min-w-6 place-items-center rounded-full px-1.5 text-[12px] font-bold text-white"
              aria-label={`Заявок: ${pending}`}
            >
              {pending}
            </span>
          )}
          <ChevronRight className="text-secondary size-5" aria-hidden />
        </Link>
      )}
    </Card>
  );
}
