"use client";

/** «Где купить» на странице вида: предложения проверенных магазинов — свой город первым. */

import { ExternalLink, LogIn, MapPin, Store, Truck } from "lucide-react";
import Link from "next/link";
import { useSession } from "@/components/session";
import { ErrorNote, Spinner } from "@/components/ui";
import { sizeLabel, withUtm, type Offer } from "@/lib/domain/shop";
import { useProfile, useWhereToBuy } from "@/lib/queries";
import { VerifiedMark, priceText, shopHref } from "./badges";

function OfferRow({ offer: o }: { offer: Offer }) {
  const size = sizeLabel(o);
  return (
    <li className="flex items-center gap-3 py-3">
      <Link href={shopHref(o.shopId)} className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-[15px] font-semibold">
          <span className="truncate">{o.shopName}</span> <VerifiedMark />
        </span>
        <span className="text-secondary block truncate text-[13px]">
          {o.title}
          {size && ` · ${size}`}
        </span>
        <span className="text-secondary flex items-center gap-1 text-[12px]">
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
            className="text-leaf inline-flex items-center gap-1 text-[13px] font-semibold"
          >
            В магазин <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : (
          <Link href={shopHref(o.shopId)} className="text-leaf text-[13px] font-semibold">
            Контакты
          </Link>
        )}
      </div>
    </li>
  );
}

function WhereToBuyInner({ speciesId }: { speciesId: string }) {
  const profile = useProfile();
  const city = profile.data?.city?.trim() || null;
  const offers = useWhereToBuy(speciesId, city, !profile.isPending);
  if (profile.isPending || offers.isPending) return <Spinner />;
  if (offers.error) return <ErrorNote error={offers.error} onRetry={() => offers.refetch()} />;
  if (!offers.data.length) {
    return (
      <p className="text-secondary text-[15px]">
        {city ? `В г. ${city} и с доставкой пока не продают.` : "Пока нигде не продают."} Нажмите «Хочу купить» — пришлём уведомление, когда
        появится.
        {!city && (
          <>
            {" "}
            <Link href="/profile/" className="text-leaf font-medium">
              Укажите город
            </Link>
            , чтобы видеть магазины рядом.
          </>
        )}
      </p>
    );
  }
  return (
    <ul className="divide-separator divide-y" aria-label="Предложения магазинов">
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
    <section className="bg-surface mt-6 rounded-[20px] p-5">
      <h3 className="flex items-center gap-2 text-[17px] font-semibold">
        <Store className="text-leaf size-5" aria-hidden /> Где купить
      </h3>
      <div className="mt-2">
        {session.status === "loading" ? (
          <Spinner />
        ) : session.status === "guest" ? (
          <p className="text-secondary text-[15px]">
            <Link href="/login/" className="text-leaf inline-flex items-center gap-1 font-medium">
              <LogIn className="size-4" aria-hidden /> Войдите
            </Link>
            , чтобы увидеть цены проверенных магазинов в вашем городе.
          </p>
        ) : (
          <WhereToBuyInner speciesId={speciesId} />
        )}
      </div>
      <p className="text-secondary mt-3 text-[12px]">
        Магазины проверяются вручную. Покупка — на сайте магазина, «Подоконник» не берёт комиссию.{" "}
        <Link href="/shop/manage/" className="hover:text-label font-medium">
          Вы магазин?
        </Link>
      </p>
    </section>
  );
}
