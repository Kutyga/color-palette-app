"use client";

import { ChevronLeft, Clock, ExternalLink, Globe, Leaf, MapPin, Phone, Search, Store, Truck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { RequireSession } from "@/components/app-shell";
import { ProductPhoto, ShopStatusPill, VerifiedMark } from "@/components/shops";
import { EmptyState, ErrorNote, Spinner, cx, inputClass } from "@/components/ui";
import { sizeLabel, telHref, withUtm, type Shop, type ShopProduct } from "@/lib/domain/shop";
import { speciesMatches, speciesName } from "@/lib/domain/species";
import { speciesById } from "@/lib/knowledge";
import { useShop, useShopProducts } from "@/lib/queries";

function hostOf(url: string | null) {
  try {
    return url ? new URL(url).host.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

function Contacts({ shop: s }: { shop: Shop }) {
  const site = hostOf(s.website);
  return (
    <ul className="space-y-2 text-[15px]">
      {s.phone && (
        <li>
          <a href={telHref(s.phone)} className="text-leaf inline-flex items-center gap-2 font-medium">
            <Phone className="size-4" aria-hidden /> {s.phone}
          </a>
        </li>
      )}
      {s.website && site && (
        <li>
          <a
            href={withUtm(s.website, "storefront")}
            target="_blank"
            rel="noopener noreferrer"
            className="text-leaf inline-flex items-center gap-2 font-medium"
          >
            <Globe className="size-4" aria-hidden /> {site}
          </a>
        </li>
      )}
      {s.address && (
        <li className="text-secondary flex items-center gap-2">
          <MapPin className="size-4 shrink-0" aria-hidden /> {s.city}, {s.address}
        </li>
      )}
      {s.hours && (
        <li className="text-secondary flex items-center gap-2">
          <Clock className="size-4 shrink-0" aria-hidden /> {s.hours}
        </li>
      )}
      {s.delivery && (
        <li className="text-secondary flex items-center gap-2">
          <Truck className="size-4 shrink-0" aria-hidden /> Есть доставка
        </li>
      )}
    </ul>
  );
}

function ProductCard({ product: p }: { product: ShopProduct }) {
  const sp = speciesById(p.speciesId);
  const size = sizeLabel(p);
  const body = (
    <>
      <div className="relative">
        <ProductPhoto product={p} className="aspect-square w-full" />
        {!p.inStock && (
          <span className="absolute right-2 bottom-2 rounded-full bg-black/70 px-2.5 py-1 text-[12px] font-semibold text-white">
            Нет в наличии
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="text-[17px] font-bold">{p.priceRub == null ? "Цена по запросу" : `${p.priceRub.toLocaleString("ru-RU")} ₽`}</p>
        <p className="line-clamp-2 text-[15px] leading-snug">{p.title}</p>
        {size && <p className="text-secondary mt-0.5 text-[12px]">{size}</p>}
        {p.url && (
          <p className="text-leaf mt-1.5 inline-flex items-center gap-1 text-[13px] font-semibold">
            В магазин <ExternalLink className="size-3.5" aria-hidden />
          </p>
        )}
      </div>
    </>
  );
  return (
    <li className={cx("bg-surface overflow-hidden rounded-[20px]", !p.inStock && "opacity-60")}>
      {p.url ? (
        <a
          href={withUtm(p.url, "storefront")}
          target="_blank"
          rel="noopener noreferrer"
          className="block transition hover:brightness-[0.98]"
        >
          {body}
        </a>
      ) : (
        body
      )}
      {sp && (
        <Link href={`/plants/${sp.slug}/`} className="text-secondary hover:text-leaf flex items-center gap-1 px-3 pb-3 text-[12px]">
          <Leaf className="size-3.5" aria-hidden /> Уход: {speciesName(sp)}
        </Link>
      )}
    </li>
  );
}

function Catalog({ shopId }: { shopId: string }) {
  const products = useShopProducts(shopId);
  const [query, setQuery] = useState("");
  if (products.isPending) return <Spinner />;
  if (products.error) return <ErrorNote error={products.error} onRetry={() => products.refetch()} />;
  if (!products.data.length) return <EmptyState icon={Leaf} title="Каталог пока пуст" message="Магазин ещё не загрузил товары." />;
  const q = query.trim().toLowerCase();
  const shown = products.data
    .filter((p) => {
      if (!q) return true;
      const sp = speciesById(p.speciesId);
      return p.title.toLowerCase().includes(q) || (sp != null && speciesMatches(sp, q));
    })
    .sort((a, b) => Number(b.inStock) - Number(a.inStock));
  return (
    <>
      <label className="relative mb-4 block">
        <Search className="text-secondary pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2" aria-hidden />
        <input
          className={cx(inputClass, "pl-12")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Поиск среди ${products.data.length} товаров`}
          aria-label="Поиск по каталогу"
        />
      </label>
      {shown.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Каталог">
          {shown.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </ul>
      ) : (
        <p className="text-secondary py-10 text-center">Ничего не нашлось</p>
      )}
    </>
  );
}

function Storefront() {
  const id = useSearchParams().get("id");
  const shop = useShop(id);
  if (!id) return <EmptyState icon={Store} title="Магазин не найден" message="Ссылка неполная." />;
  if (shop.isPending) return <Spinner />;
  if (shop.error) return <ErrorNote error={shop.error} onRetry={() => shop.refetch()} />;
  if (!shop.data) return <EmptyState icon={Store} title="Магазин не найден" message="Он скрыт или ещё не прошёл проверку." />;
  const s = shop.data;
  return (
    <div className="space-y-6">
      {s.mine && s.status !== "verified" && (
        <div className="bg-soil/10 rounded-2xl px-4 py-3 text-[15px]">
          <ShopStatusPill status={s.status} /> Витрину видите только вы — остальным она откроется после проверки.{" "}
          <Link href="/shop/manage/" className="text-leaf font-semibold">
            Управление магазином
          </Link>
        </div>
      )}
      <header className="bg-surface grid gap-5 rounded-[28px] p-5 md:grid-cols-[1fr_auto] md:p-6">
        <div>
          <h1 className="flex items-center gap-2 text-[28px] leading-tight font-bold tracking-tight">
            {s.name} {s.status === "verified" && <VerifiedMark />}
          </h1>
          <p className="text-secondary mt-1 text-[13px]">
            {s.status === "verified" ? "Проверенный магазин" : "Магазин"} · {s.city}
          </p>
          {s.description && <p className="mt-3 max-w-2xl text-[17px] leading-relaxed whitespace-pre-line">{s.description}</p>}
        </div>
        <Contacts shop={s} />
      </header>
      <Catalog shopId={s.id} />
      <p className="text-secondary text-[12px]">
        Цены и наличие указывает магазин. Покупка и оплата — напрямую у магазина.{s.inn && ` ИНН ${s.inn}.`}
      </p>
    </div>
  );
}

export default function ShopPage() {
  return (
    <>
      <div className="pt-4 pb-3">
        <Link href="/feed/?tab=market" className="text-leaf inline-flex items-center gap-1 text-[15px] font-medium">
          <ChevronLeft className="size-5" aria-hidden /> Барахолка
        </Link>
      </div>
      <RequireSession>
        <Suspense fallback={<Spinner />}>
          <Storefront />
        </Suspense>
      </RequireSession>
    </>
  );
}
