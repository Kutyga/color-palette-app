"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Flag, Leaf, MapPin, MessageCircle, Pencil, Store, Trash2, Truck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { RequireSession } from "@/components/app-shell";
import { KindBadge, ReportSheet, listingPhoto } from "@/components/market";
import { personHref } from "@/components/people";
import { useBackend } from "@/components/session";
import { Avatar, Button, EmptyState, ErrorNote, PlantPhoto, Sheet, Spinner, useToast } from "@/components/ui";
import { LISTING_STATUS, priceLabel, type Listing, type ListingStatus } from "@/lib/domain/market";
import { speciesName } from "@/lib/domain/species";
import { timeAgo } from "@/lib/format";
import { speciesById } from "@/lib/knowledge";
import { useListing } from "@/lib/queries";

/** Кнопки продавца: статус, правка, удаление. */
function OwnerActions({ listing }: { listing: Listing }) {
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["market"] });
  const status = useMutation({
    mutationFn: (s: ListingStatus) => backend.market.setStatus(listing.id, s),
    onSuccess: (_d, s) => {
      toast(s === "closed" ? "Объявление закрыто" : s === "reserved" ? "Отмечено: забронировано" : "Объявление снова актуально");
      refresh();
    },
    onError: (e) => toast(e.message),
  });
  const remove = useMutation({
    mutationFn: () => backend.market.deleteListing(listing.id),
    onSuccess: () => {
      toast("Объявление удалено");
      refresh();
      router.replace("/feed/?tab=market");
    },
    onError: (e) => toast(e.message),
  });
  const next: [ListingStatus, string][] =
    listing.status === "active"
      ? [
          ["reserved", "Забронировано"],
          ["closed", listing.kind === "wanted" ? "Нашёл — закрыть" : "Отдал(а) — закрыть"],
        ]
      : listing.status === "reserved"
        ? [
            ["active", "Снова актуально"],
            ["closed", "Закрыть"],
          ]
        : [["active", "Открыть снова"]];
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {next.map(([s, label]) => (
          <Button key={s} variant="secondary" className="flex-1" loading={status.isPending && status.variables === s} onClick={() => status.mutate(s)}>
            {label}
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        <Link href={`/market/new/?id=${encodeURIComponent(listing.id)}`} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-muted text-[15px] font-semibold">
          <Pencil className="size-4" aria-hidden /> Изменить
        </Link>
        <Link href="/messages/" className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-muted text-[15px] font-semibold">
          <MessageCircle className="size-4" aria-hidden /> Сообщения
        </Link>
        <button type="button" onClick={() => setConfirm(true)} aria-label="Удалить объявление" className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-alert">
          <Trash2 className="size-5" />
        </button>
      </div>
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Удалить объявление?">
        <p className="text-secondary">Объявление пропадёт из «Барахолки». Переписка с покупателями сохранится.</p>
        <div className="mt-5 flex gap-2 pb-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirm(false)}>
            Отмена
          </Button>
          <Button variant="danger" className="flex-1" loading={remove.isPending} onClick={() => remove.mutate()}>
            Удалить
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function ContactButton({ listing }: { listing: Listing }) {
  const backend = useBackend();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const start = useMutation({
    mutationFn: () => backend.chat.start(listing.id),
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["chat"] });
      router.push(`/messages/chat/?id=${encodeURIComponent(id)}`);
    },
    onError: (e) => toast(e.message),
  });
  if (listing.status === "closed") return <p className="rounded-2xl bg-muted px-4 py-3 text-center text-secondary">Объявление закрыто</p>;
  return (
    <Button className="min-h-12 w-full" loading={start.isPending} onClick={() => start.mutate()}>
      <MessageCircle className="size-5" aria-hidden /> {listing.kind === "wanted" ? "У меня есть — написать" : "Написать продавцу"}
    </Button>
  );
}

function ListingView() {
  const id = useSearchParams().get("id");
  const listing = useListing(id);
  const [reporting, setReporting] = useState(false);
  if (!id) return <EmptyState icon={Store} title="Объявление не найдено" message="Ссылка неполная." />;
  if (listing.isPending) return <Spinner />;
  if (listing.error) return <ErrorNote error={listing.error} onRetry={() => listing.refetch()} />;
  if (!listing.data) return <EmptyState icon={Store} title="Объявление не найдено" message="Его удалили или оно скрыто." />;
  const l = listing.data;
  const sp = speciesById(l.speciesId);
  const photo = listingPhoto(l);
  return (
    <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
      <div>
        <div className="relative overflow-hidden rounded-[28px]">
          <PlantPhoto src={photo} seed={l.id} alt={l.title} className="aspect-square w-full" iconSize={64} />
          <KindBadge kind={l.kind} className="absolute top-3 left-3" />
        </div>
        {!l.photoUrls.length && photo && <p className="mt-2 text-center text-[13px] text-secondary">Фото вида из базы знаний</p>}
      </div>
      <div className="space-y-4">
        <div>
          {l.status !== "active" && (
            <span className="mb-2 inline-block rounded-full bg-muted px-3 py-1 text-[13px] font-semibold">{LISTING_STATUS[l.status]}</span>
          )}
          <p className="text-[28px] leading-tight font-bold">{priceLabel(l)}</p>
          <h1 className="mt-1 text-[22px] leading-snug font-semibold">{l.title}</h1>
          {sp && (
            <Link href={`/plants/${sp.slug}/`} className="mt-1 inline-flex items-center gap-1 text-[15px] text-secondary hover:text-leaf">
              <Leaf className="size-4" aria-hidden /> {speciesName(sp)}
            </Link>
          )}
        </div>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-secondary">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-4" aria-hidden /> {l.city}
          </span>
          {l.delivery && (
            <span className="inline-flex items-center gap-1">
              <Truck className="size-4" aria-hidden /> Есть доставка
            </span>
          )}
          <span>{timeAgo(l.createdAt)}</span>
        </p>
        {l.swapFor && (
          <p className="rounded-2xl bg-muted px-4 py-3 text-[15px]">
            <b>Меняю на:</b> {l.swapFor}
          </p>
        )}
        {l.description && <p className="text-[17px] leading-relaxed whitespace-pre-line">{l.description}</p>}
        <Link href={l.mine ? "/profile/" : personHref(l.sellerName)} className="flex items-center gap-3 rounded-2xl bg-surface p-3">
          <Avatar name={l.sellerDisplayName} size={44} />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{l.sellerDisplayName}</span>
            <span className="block text-[13px] text-secondary">{l.mine ? "Это ваше объявление" : l.kind === "wanted" ? "Ищет растение" : "Продавец"}</span>
          </span>
        </Link>
        {l.mine ? <OwnerActions listing={l} /> : <ContactButton listing={l} />}
        {!l.mine && (
          <>
            <p className="text-[13px] text-secondary">Не переводите предоплату незнакомым. Встречайтесь в людных местах и проверяйте растение при получении.</p>
            <button type="button" onClick={() => setReporting(true)} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-secondary hover:text-alert">
              <Flag className="size-4" aria-hidden /> Пожаловаться
            </button>
            <ReportSheet open={reporting} onClose={() => setReporting(false)} target={{ type: "listing", id: l.id }} />
          </>
        )}
      </div>
    </div>
  );
}

export default function ListingPage() {
  return (
    <>
      <div className="pt-4 pb-3">
        <Link href="/feed/?tab=market" className="inline-flex items-center gap-1 text-[15px] font-medium text-leaf">
          <ChevronLeft className="size-5" aria-hidden /> Барахолка
        </Link>
      </div>
      <RequireSession>
        <Suspense fallback={<Spinner />}>
          <ListingView />
        </Suspense>
      </RequireSession>
    </>
  );
}
