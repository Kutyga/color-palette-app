"use client";

/**
 * Карточка статуса магазина: этап проверки, комментарий модератора, переход к витрине.
 */

import { BadgeCheck, Store } from "lucide-react";
import Link from "next/link";
import { useSession } from "@/components/session";
import { ShopStatusPill, shopHref } from "@/components/shops";
import { Button, Card } from "@/components/ui";
import type { Shop } from "@/lib/domain/shop";

const STATUS_TEXT: Record<Shop["status"], string> = {
  pending: "Проверяем магазин. Пока витрину видите только вы — можно загрузить каталог заранее.",
  verified: "Витрина открыта всем, товары показываются в «Где купить» на страницах растений.",
  rejected: "Заявка отклонена. Исправьте анкету — она снова уйдёт на проверку.",
  suspended: "Магазин скрыт модератором. Напишите нам, если это ошибка.",
};

export function StatusCard({ shop, onEdit }: { shop: Shop; onEdit: () => void }) {
  const { session } = useSession();
  const isDemo = session.status === "ready" && session.backend.mode === "demo";
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="bg-leaf/10 text-leaf grid size-12 shrink-0 place-items-center rounded-2xl">
          {shop.status === "verified" ? <BadgeCheck className="size-6" aria-hidden /> : <Store className="size-6" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-[19px] font-semibold">
            <span className="truncate">{shop.name}</span> <ShopStatusPill status={shop.status} />
          </p>
          <p className="text-secondary mt-1 text-[15px]">{STATUS_TEXT[shop.status]}</p>
          {shop.reviewNote && <p className="bg-muted mt-2 rounded-xl px-3 py-2 text-[15px]">Комментарий модератора: {shop.reviewNote}</p>}
          {isDemo && shop.status === "pending" && <p className="text-secondary mt-2 text-[13px]">В демо-режиме заявки не проверяются.</p>}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Link
          href={shopHref(shop.id)}
          className="bg-muted inline-flex min-h-11 flex-1 items-center justify-center rounded-full text-[15px] font-semibold"
        >
          Открыть витрину
        </Link>
        <Button variant="secondary" className="flex-1" onClick={onEdit}>
          Изменить анкету
        </Button>
      </div>
    </Card>
  );
}
