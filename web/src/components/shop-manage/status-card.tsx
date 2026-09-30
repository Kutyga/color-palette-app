"use client";

/**
 * Карточка статуса магазина: этап проверки, комментарий модератора, переход к витрине, удаление.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Store, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useBackend, useSession } from "@/components/session";
import { ShopStatusPill, shopHref } from "@/components/shops";
import { Button, Card, useToast } from "@/components/ui";
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
          {isDemo && shop.status === "pending" && (
            <p className="text-secondary mt-2 text-[13px]">В тестовом режиме заявки не проверяются.</p>
          )}
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
      <DeleteShop />
    </Card>
  );
}

/** Удаление магазина: с подтверждением, каталог удаляется вместе с ним. */
function DeleteShop() {
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const remove = useMutation({
    mutationFn: () => backend.shops.deleteShop(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shops"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast("Магазин удалён");
    },
    onError: (e) => toast(e.message),
  });
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-alert mt-3 flex items-center gap-1.5 text-[15px] font-medium"
      >
        <Trash2 className="size-4" aria-hidden /> Удалить магазин
      </button>
    );
  }
  return (
    <div className="bg-alert/10 mt-4 rounded-2xl p-4" role="alert">
      <p className="font-semibold">Удалить магазин навсегда?</p>
      <p className="text-secondary mt-1 text-[15px]">Витрина и весь каталог исчезнут, восстановить их будет нельзя.</p>
      <div className="mt-3 flex gap-2">
        <Button variant="danger" className="flex-1" loading={remove.isPending} onClick={() => remove.mutate()}>
          Удалить
        </Button>
        <Button variant="secondary" className="flex-1" onClick={() => setConfirming(false)}>
          Отмена
        </Button>
      </div>
    </div>
  );
}
