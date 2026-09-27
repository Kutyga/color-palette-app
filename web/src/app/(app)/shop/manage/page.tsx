"use client";

import { useState } from "react";
import { RequireSession } from "@/components/app-shell";
import { CatalogManager } from "@/components/shop-manage/catalog-manager";
import { ShopForm } from "@/components/shop-manage/shop-form";
import { StatusCard } from "@/components/shop-manage/status-card";
import { Card, ErrorNote, PageHeader, Spinner } from "@/components/ui";
import { useMyShop } from "@/lib/queries";

// ---------------------------------------------------------------------------

function Intro() {
  return (
    <Card className="p-5">
      <p className="text-[19px] font-semibold">Магазин в «Подоконнике» — бесплатно</p>
      <ul className="text-secondary mt-3 space-y-2 text-[15px]">
        <li>🏪 Витрина с каталогом, ценами и контактами</li>
        <li>📍 Ваши товары в блоке «Где купить» на страницах растений — сначала покупателям из вашего города</li>
        <li>🔔 Уведомление тем, кто добавил растение в «Хочу», когда оно появится у вас или подешевеет</li>
        <li>📄 Каталог загружается из Excel или CSV и выгружается обратно</li>
      </ul>
      <p className="text-secondary mt-3 text-[13px]">
        Для значка ✓ проверяем магазин вручную — обычно за 1–2 дня. Деньги через приложение не проходят: покупатель переходит на ваш сайт
        или звонит.
      </p>
    </Card>
  );
}

function Manage() {
  const shop = useMyShop();
  const [editing, setEditing] = useState(false);
  if (shop.isPending) return <Spinner />;
  if (shop.error) return <ErrorNote error={shop.error} onRetry={() => shop.refetch()} />;
  if (!shop.data) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Intro />
        <Card className="p-5">
          <h2 className="mb-4 text-[19px] font-semibold">Заявка</h2>
          <ShopForm shop={null} />
        </Card>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {editing ? (
        <Card className="p-5">
          <h2 className="mb-4 text-[19px] font-semibold">Анкета магазина</h2>
          <ShopForm shop={shop.data} onDone={() => setEditing(false)} />
        </Card>
      ) : (
        <StatusCard shop={shop.data} onEdit={() => setEditing(true)} />
      )}
      <CatalogManager shop={shop.data} />
    </div>
  );
}

export default function ManageShopPage() {
  return (
    <>
      <PageHeader title="Мой магазин" />
      <RequireSession>
        <Manage />
      </RequireSession>
    </>
  );
}
