"use client";

import { BadgeCheck, ChevronRight, ExternalLink, Heart, LogIn, MapPin, ShieldCheck, Store, Truck } from "lucide-react";
import Link from "next/link";
import { useSession } from "./session";
import { Card, EmptyState, ErrorNote, PlantPhoto, Spinner, cx, useToast } from "./ui";
import { SHOP_STATUS, sizeLabel, withUtm, type Offer, type Shop, type ShopStatus } from "@/lib/domain/shop";
import { speciesName } from "@/lib/domain/species";
import { speciesById } from "@/lib/knowledge";
import { useMyShop, useProfile, useReviewQueue, useSetWished, useShops, useWhereToBuy, useWishlist } from "@/lib/queries";

export const shopHref = (id: string) => `/shop/?id=${encodeURIComponent(id)}`;

const STATUS_TONE: Record<ShopStatus, string> = {
  pending: "bg-soil/15 text-soil",
  verified: "bg-leaf/15 text-leaf",
  rejected: "bg-alert/15 text-alert",
  suspended: "bg-muted text-secondary",
};

export function ShopStatusPill({ status }: { status: ShopStatus }) {
  return <span className={cx("inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-semibold", STATUS_TONE[status])}>{SHOP_STATUS[status]}</span>;
}

/** Значок проверенного магазина. */
export function VerifiedMark({ className }: { className?: string }) {
  return <BadgeCheck className={cx("inline size-[1em] shrink-0 text-leaf", className)} aria-label="Проверенный магазин" />;
}

const priceText = (rub: number | null) => (rub == null ? "Цена по запросу" : `${rub.toLocaleString("ru-RU")} ₽`);

function OfferRow({ offer: o }: { offer: Offer }) {
  const size = sizeLabel(o);
  return (
    <li className="flex items-center gap-3 py-3">
      <Link href={shopHref(o.shopId)} className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-[15px] font-semibold">
          <span className="truncate">{o.shopName}</span> <VerifiedMark />
        </span>
        <span className="block truncate text-[13px] text-secondary">
          {o.title}
          {size && ` · ${size}`}
        </span>
        <span className="flex items-center gap-1 text-[12px] text-secondary">
          {o.sameCity ? (
            <>
              <MapPin className="size-3.5" aria-hidden /> {o.shopCity}
            </>
          ) : (
            <>
              <Truck className="size-3.5" aria-hidden /> Доставка из г. {o.shopCity}
            </>
          )}
        </span>
      </Link>
      <div className="shrink-0 text-right">
        <p className="text-[17px] font-bold">{priceText(o.priceRub)}</p>
        {o.url ? (
          <a
            href={withUtm(o.url, "where_to_buy")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-leaf"
          >
            В магазин <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : (
          <Link href={shopHref(o.shopId)} className="text-[13px] font-semibold text-leaf">
            Контакты
          </Link>
        )}
      </div>
    </li>
  );
}

function WishButtonInner({ speciesId }: { speciesId: string }) {
  const wishlist = useWishlist();
  const set = useSetWished();
  const toast = useToast();
  const wanted = wishlist.data?.includes(speciesId) ?? false;
  return (
    <button
      type="button"
      aria-pressed={wanted}
      disabled={wishlist.isPending}
      onClick={() =>
        set.mutate(
          { speciesId, wanted: !wanted },
          {
            onSuccess: () => toast(wanted ? "Убрано из «Хочу»" : "Добавлено в «Хочу» — сообщим, когда появится в продаже или подешевеет"),
            onError: (e) => toast(`Не сохранилось: ${e.message}`),
          },
        )
      }
      className={cx(
        "inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-[17px] font-semibold transition disabled:opacity-50",
        wanted ? "bg-alert/10 text-alert" : "bg-muted text-label hover:brightness-95",
      )}
    >
      <Heart className={cx("size-5", wanted && "fill-current")} aria-hidden /> {wanted ? "Хочу" : "Хочу купить"}
    </button>
  );
}

/** «Хочу купить» на странице вида; гостю — приглашение войти. */
export function WishButton({ speciesId }: { speciesId: string }) {
  const { session } = useSession();
  if (session.status === "loading") return null;
  if (session.status === "guest") {
    return (
      <Link href="/login/" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-muted px-6 text-[17px] font-semibold">
        <Heart className="size-5" aria-hidden /> Хочу купить
      </Link>
    );
  }
  return <WishButtonInner speciesId={speciesId} />;
}

function WhereToBuyInner({ speciesId }: { speciesId: string }) {
  const profile = useProfile();
  const city = profile.data?.city?.trim() || null;
  const offers = useWhereToBuy(speciesId, city, !profile.isPending);
  if (profile.isPending || offers.isPending) return <Spinner />;
  if (offers.error) return <ErrorNote error={offers.error} onRetry={() => offers.refetch()} />;
  if (!offers.data.length) {
    return (
      <p className="text-[15px] text-secondary">
        {city ? `В г. ${city} и с доставкой пока не продают.` : "Пока нигде не продают."} Нажмите «Хочу купить» — пришлём уведомление, когда появится.
        {!city && (
          <>
            {" "}
            <Link href="/profile/" className="font-medium text-leaf">
              Укажите город
            </Link>
            , чтобы видеть магазины рядом.
          </>
        )}
      </p>
    );
  }
  return (
    <ul className="divide-y divide-separator" aria-label="Предложения магазинов">
      {offers.data.map((o) => (
        <OfferRow key={o.productId} offer={o} />
      ))}
    </ul>
  );
}

/** Блок «Где купить» на странице вида: проверенные магазины своего города и с доставкой. */
export function WhereToBuy({ speciesId }: { speciesId: string }) {
  const { session } = useSession();
  return (
    <section className="mt-6 rounded-[20px] bg-surface p-5">
      <h3 className="flex items-center gap-2 text-[17px] font-semibold">
        <Store className="size-5 text-leaf" aria-hidden /> Где купить
      </h3>
      <div className="mt-2">
        {session.status === "loading" ? (
          <Spinner />
        ) : session.status === "guest" ? (
          <p className="text-[15px] text-secondary">
            <Link href="/login/" className="inline-flex items-center gap-1 font-medium text-leaf">
              <LogIn className="size-4" aria-hidden /> Войдите
            </Link>
            , чтобы увидеть цены проверенных магазинов в вашем городе.
          </p>
        ) : (
          <WhereToBuyInner speciesId={speciesId} />
        )}
      </div>
      <p className="mt-3 text-[12px] text-secondary">
        Магазины проверяются вручную по ИНН. Покупка — на сайте магазина, «Подоконник» не берёт комиссию.{" "}
        <Link href="/shop/manage/" className="font-medium hover:text-label">
          Вы магазин?
        </Link>
      </p>
    </section>
  );
}

function ShopRow({ shop: s, myCity }: { shop: Shop; myCity: string | null }) {
  return (
    <li>
      <Link href={shopHref(s.id)} className="flex items-center gap-3 rounded-[20px] bg-surface p-4 transition hover:brightness-[0.98]">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-leaf/10 text-leaf">
          <Store className="size-6" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 font-semibold">
            <span className="truncate">{s.name}</span> <VerifiedMark />
          </span>
          <span className="block truncate text-[13px] text-secondary">{s.description || s.address || s.city}</span>
          <span className="mt-0.5 flex items-center gap-3 text-[12px] text-secondary">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden /> {s.city}
            </span>
            {s.delivery && (
              <span className="inline-flex items-center gap-1">
                <Truck className="size-3.5" aria-hidden /> {myCity && s.city.toLowerCase() === myCity.toLowerCase() ? "Доставка" : "Доставка в ваш город"}
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
          <Link href="/shop/manage/" className="rounded-full bg-leaf px-6 py-3 font-semibold text-white">
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
      <p className="mt-4 text-center text-[13px] text-secondary">
        <Link href="/shop/manage/" className="font-medium text-leaf">
          Вы магазин? Разместите каталог бесплатно
        </Link>
      </p>
    </>
  );
}

/** Фото товара: своё из каталога или фото вида. */
export const productPhoto = (p: { imageUrl: string | null; speciesId: string | null }) => p.imageUrl ?? speciesById(p.speciesId)?.image?.url ?? null;

export function ProductPhoto({ product, className }: { product: { id: string; title: string; imageUrl: string | null; speciesId: string | null }; className?: string }) {
  return <PlantPhoto src={productPhoto(product)} seed={product.id} alt={product.title} className={className} iconSize={32} />;
}

/** Карточка в профиле: свой магазин, а у администратора — ещё и заявки на проверку. */
export function ProfileShopCard() {
  const shop = useMyShop();
  const profile = useProfile();
  const isAdmin = profile.data?.isAdmin ?? false;
  const queue = useReviewQueue(isAdmin);
  const pending = queue.data?.filter((s) => s.status === "pending").length ?? 0;
  return (
    <Card className="divide-y divide-separator">
      <Link href="/shop/manage/" className="flex items-center gap-4 p-5">
        <Store className="size-6 text-leaf" aria-hidden />
        <span className="min-w-0 flex-1">
          {shop.data ? (
            <>
              <span className="flex flex-wrap items-center gap-2 font-semibold">
                <span className="truncate">{shop.data.name}</span> <ShopStatusPill status={shop.data.status} />
              </span>
              <span className="block text-[15px] text-secondary">Витрина, каталог и цены</span>
            </>
          ) : (
            <>
              <span className="block font-semibold">Вы продаёте растения?</span>
              <span className="block text-[15px] text-secondary">Откройте магазин — бесплатно</span>
            </>
          )}
        </span>
        <ChevronRight className="size-5 text-secondary" aria-hidden />
      </Link>
      {isAdmin && (
        <Link href="/admin/shops/" className="flex items-center gap-4 p-5">
          <ShieldCheck className="size-6 text-soil" aria-hidden />
          <span className="flex-1 font-semibold">Проверка магазинов</span>
          {pending > 0 && (
            <span className="grid min-w-6 place-items-center rounded-full bg-alert px-1.5 text-[12px] font-bold text-white" aria-label={`Заявок: ${pending}`}>
              {pending}
            </span>
          )}
          <ChevronRight className="size-5 text-secondary" aria-hidden />
        </Link>
      )}
    </Card>
  );
}

/** Список «Хочу» в профиле. */
export function WishlistCard() {
  const wishlist = useWishlist();
  const species = (wishlist.data ?? []).map((id) => speciesById(id)).filter((s) => s != null);
  return (
    <Card className="p-5">
      <p className="flex items-center gap-2 font-semibold">
        <Heart className="size-5 text-alert" aria-hidden /> Хочу купить
      </p>
      {wishlist.isPending ? (
        <Spinner />
      ) : species.length ? (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Хочу купить">
          {species.map((s) => (
            <li key={s.id}>
              <Link href={`/plants/${s.slug}/`} className="inline-flex rounded-full bg-muted px-3 py-1.5 text-[13px] font-medium hover:brightness-95">
                {speciesName(s)}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[15px] text-secondary">
          Отмечайте «Хочу купить» на страницах растений в{" "}
          <Link href="/plants/" className="font-medium text-leaf">
            «Знаниях»
          </Link>{" "}
          — сообщим, когда растение появится в магазинах или подешевеет.
        </p>
      )}
    </Card>
  );
}
