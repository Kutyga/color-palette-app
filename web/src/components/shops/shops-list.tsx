"use client";

/** Список проверенных магазинов для вкладки «Магазины» барахолки: свой город первым. */

import { MapPin, Store, Truck } from "lucide-react";
import Link from "next/link";
import { EmptyState, ErrorNote, Spinner } from "@/components/ui";
import type { Shop } from "@/lib/domain/shop";
import { useProfile, useShops } from "@/lib/queries";
import { VerifiedMark, shopHref } from "./badges";

function ShopRow({ shop: s, myCity }: { shop: Shop; myCity: string | null }) {
  return (
    <li>
      <Link href={shopHref(s.id)} className="bg-surface flex items-center gap-3 rounded-[20px] p-4 transition hover:brightness-[0.98]">
        <span className="bg-leaf/10 text-leaf grid size-12 shrink-0 place-items-center rounded-2xl">
          <Store className="size-6" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 font-semibold">
            <span className="truncate">{s.name}</span> <VerifiedMark />
          </span>
          <span className="text-secondary block truncate text-[13px]">{s.description || s.address || s.city}</span>
          <span className="text-secondary mt-0.5 flex items-center gap-3 text-[12px]">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden /> {s.city}
            </span>
            {s.delivery && (
              <span className="inline-flex items-center gap-1">
                <Truck className="size-3.5" aria-hidden />{" "}
                {myCity && s.city.toLowerCase() === myCity.toLowerCase() ? "Доставка" : "Доставка в ваш город"}
              </span>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}

/** Вкладка «Магазины» в барахолке: проверенные магазины, свой город первым. */
export function ShopsList() {
  const profile = useProfile();
  const city = profile.data?.city?.trim() || null;
  const shops = useShops(city);
  if (shops.isPending) return <Spinner />;
  if (shops.error) return <ErrorNote error={shops.error} onRetry={() => shops.refetch()} />;
  if (!shops.data.length) {
    return (
      <EmptyState
        icon={Store}
        title="Магазинов пока нет"
        message="Здесь появятся проверенные магазины растений с ценами и наличием."
        action={
          <Link href="/shop/manage/" className="bg-leaf rounded-full px-6 py-3 font-semibold text-white">
            Открыть свой магазин
          </Link>
        }
      />
    );
  }
  return (
    <>
      <ul className="space-y-3">
        {shops.data.map((s) => (
          <ShopRow key={s.id} shop={s} myCity={city} />
        ))}
      </ul>
      <p className="text-secondary mt-4 text-center text-[13px]">
        <Link href="/shop/manage/" className="text-leaf font-medium">
          Вы магазин? Разместите каталог бесплатно
        </Link>
      </p>
    </>
  );
}
