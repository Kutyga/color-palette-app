"use client";

import { MapPin, Store, Truck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useBackend } from "./session";
import { ShopsList } from "./shops";
import { Chip, EmptyState, ErrorNote, PlantPhoto, Sheet, Spinner, cx, useToast } from "./ui";
import { LISTING_KINDS, LISTING_STATUS, priceLabel, type Listing, type ListingFilter, type ListingKind } from "@/lib/domain/market";
import { speciesName } from "@/lib/domain/species";
import { timeAgo } from "@/lib/format";
import { speciesById } from "@/lib/knowledge";
import { useListings, useMyListings, useProfile } from "@/lib/queries";

export const chatHref = (id: string) => `/messages/chat/?id=${encodeURIComponent(id)}`;
export const listingHref = (id: string) => `/market/view/?id=${encodeURIComponent(id)}`;

/** Своё фото объявления, а если его нет (объявление «Ищу») — фото вида из базы знаний. */
export const listingPhoto = (l: Pick<Listing, "photoUrls" | "speciesId">) => l.photoUrls[0] ?? speciesById(l.speciesId)?.image?.url ?? null;

export function KindBadge({ kind, className }: { kind: ListingKind; className?: string }) {
  const k = LISTING_KINDS[kind];
  return (
    <span
      className={cx(
        "bg-surface/90 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold backdrop-blur",
        className,
      )}
    >
      <span aria-hidden>{k.emoji}</span> {k.label}
    </span>
  );
}

/** Плитка объявления в сетке. */
function ListingCard({ listing: l }: { listing: Listing }) {
  const sp = speciesById(l.speciesId);
  return (
    <li>
      <Link
        href={listingHref(l.id)}
        className="bg-surface block overflow-hidden rounded-[20px] transition hover:brightness-[0.98]"
        aria-label={`${l.title}, ${priceLabel(l)}`}
      >
        <div className="relative">
          <PlantPhoto src={listingPhoto(l)} seed={l.id} alt={l.title} className="aspect-square w-full" iconSize={36} />
          <KindBadge kind={l.kind} className="absolute top-2 left-2" />
          {l.status !== "active" && (
            <span className="absolute right-2 bottom-2 rounded-full bg-black/70 px-2.5 py-1 text-[12px] font-semibold text-white">
              {LISTING_STATUS[l.status]}
            </span>
          )}
        </div>
        <div className="p-3">
          <p className="text-[17px] font-bold">{priceLabel(l)}</p>
          <p className="line-clamp-2 text-[15px] leading-snug">{l.title}</p>
          {sp && <p className="text-secondary mt-0.5 truncate text-[12px]">{speciesName(sp)}</p>}
          <p className="text-secondary mt-1.5 flex items-center gap-1 text-[12px]">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{l.city}</span>
            {l.delivery && <Truck className="ml-1 size-3.5 shrink-0" aria-label="Есть доставка" />}
            <span className="ml-auto shrink-0">{timeAgo(l.createdAt)}</span>
          </p>
        </div>
      </Link>
    </li>
  );
}

type MarketView = ListingFilter["kind"] | "mine" | "shops";

const KIND_FILTERS: { id: MarketView; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "sell", label: "🏷️ Продаю" },
  { id: "free", label: "🎁 Даром" },
  { id: "swap", label: "🔄 Обмен" },
  { id: "wanted", label: "🔎 Ищу" },
  { id: "shops", label: "🏪 Магазины" },
  { id: "mine", label: "Мои" },
];

function Grid({ items }: { items: Listing[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((l) => (
        <ListingCard key={l.id} listing={l} />
      ))}
    </ul>
  );
}

function MineList() {
  const mine = useMyListings();
  if (mine.isPending) return <Spinner />;
  if (mine.error) return <ErrorNote error={mine.error} onRetry={() => mine.refetch()} />;
  if (!mine.data.length) {
    return (
      <EmptyState
        icon={Store}
        title="У вас пока нет объявлений"
        message="Продайте детку, отдайте черенок или найдите растение мечты."
        action={
          <Link href="/market/new/" className="bg-leaf rounded-full px-6 py-3 font-semibold text-white">
            Новое объявление
          </Link>
        }
      />
    );
  }
  return <Grid items={mine.data} />;
}

function Results({ filter }: { filter: ListingFilter }) {
  const list = useListings(filter);
  if (list.isPending) return <Spinner />;
  if (list.error) return <ErrorNote error={list.error} onRetry={() => list.refetch()} />;
  if (!list.data.length) {
    return (
      <EmptyState
        icon={Store}
        title="Объявлений пока нет"
        message={
          filter.city
            ? `В городе ${filter.city} ничего не нашлось — посмотрите все города или разместите своё.`
            : "Будьте первым — разместите объявление."
        }
        action={
          <Link href="/market/new/" className="bg-leaf rounded-full px-6 py-3 font-semibold text-white">
            Разместить объявление
          </Link>
        }
      />
    );
  }
  return <Grid items={list.data} />;
}

/** Вкладка «Барахолка»: фильтры по типу, городу и доставке. */
export function Market() {
  const profile = useProfile();
  const myCity = profile.data?.city?.trim() || null;
  const [kind, setKind] = useState<MarketView>("all");
  const [onlyMyCity, setOnlyMyCity] = useState(true);
  const [deliveryOnly, setDeliveryOnly] = useState(false);
  const city = onlyMyCity ? myCity : null;

  return (
    <div className="mx-auto max-w-3xl">
      <p className="bg-muted text-secondary mb-3 rounded-2xl px-4 py-3 text-[13px]">
        Сделки — напрямую между садоводами, приложение не берёт деньги. Не переводите предоплату незнакомым и встречайтесь в людных местах.
      </p>
      <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4">
        {KIND_FILTERS.map((f) => (
          <Chip key={f.id} active={kind === f.id} onClick={() => setKind(f.id)}>
            {f.label}
          </Chip>
        ))}
      </div>
      {kind !== "mine" && kind !== "shops" && (
        <div className="no-scrollbar -mx-4 mb-4 flex items-center gap-2 overflow-x-auto px-4">
          {myCity ? (
            <>
              <Chip active={onlyMyCity} onClick={() => setOnlyMyCity(true)}>
                📍 {myCity}
              </Chip>
              <Chip active={!onlyMyCity} onClick={() => setOnlyMyCity(false)}>
                Все города
              </Chip>
            </>
          ) : (
            <Link href="/profile/" className="bg-muted text-leaf shrink-0 rounded-full px-4 py-2 text-[13px] font-medium">
              📍 Укажите город в профиле
            </Link>
          )}
          <Chip active={deliveryOnly} onClick={() => setDeliveryOnly(!deliveryOnly)}>
            🚚 С доставкой
          </Chip>
        </div>
      )}
      {kind === "mine" ? <MineList /> : kind === "shops" ? <ShopsList /> : <Results filter={{ kind, city, deliveryOnly }} />}
    </div>
  );
}

const REPORT_REASONS = ["Мошенничество или предоплата", "Растения нет или фото из интернета", "Спам или реклама", "Грубость", "Другое"];

/** Жалоба на объявление, сообщение или садовода — уходит модераторам. */
export function ReportSheet({
  open,
  onClose,
  target,
}: {
  open: boolean;
  onClose: () => void;
  target: { type: "listing" | "message" | "profile"; id: string } | null;
}) {
  const backend = useBackend();
  const toast = useToast();
  const [sending, setSending] = useState(false);
  async function send(reason: string) {
    if (!target) return;
    setSending(true);
    try {
      await backend.market.report(target.type, target.id, reason);
      toast("Жалоба отправлена — спасибо, что помогаете");
      onClose();
    } catch (e) {
      toast(`Не отправилось: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSending(false);
    }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Пожаловаться">
      <ul className="space-y-2 pb-2">
        {REPORT_REASONS.map((r) => (
          <li key={r}>
            <button
              type="button"
              disabled={sending}
              onClick={() => send(r)}
              className="bg-muted w-full rounded-2xl px-4 py-3.5 text-left text-[15px] font-medium disabled:opacity-50"
            >
              {r}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
