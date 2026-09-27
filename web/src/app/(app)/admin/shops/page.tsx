"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { RequireSession } from "@/components/app-shell";
import { useBackend } from "@/components/session";
import { ShopStatusPill, shopHref } from "@/components/shops";
import { Button, Card, Chip, EmptyState, ErrorNote, PageHeader, Spinner, cx, inputClass, useToast } from "@/components/ui";
import { SHOP_STATUS, type Shop, type ShopStatus } from "@/lib/domain/shop";
import { timeAgo } from "@/lib/format";
import { useProfile, useReviewQueue } from "@/lib/queries";

const ACTIONS: { status: ShopStatus; label: string; variant: "primary" | "secondary" | "danger" }[] = [
  { status: "verified", label: "Подтвердить", variant: "primary" },
  { status: "rejected", label: "Отклонить", variant: "secondary" },
  { status: "suspended", label: "Скрыть", variant: "danger" },
];

function ShopReview({ shop: s }: { shop: Shop }) {
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const [note, setNote] = useState(s.reviewNote ?? "");
  const review = useMutation({
    mutationFn: (status: ShopStatus) => backend.shops.review(s.id, status, note),
    onSuccess: (_d, status) => {
      qc.invalidateQueries({ queryKey: ["shops"] });
      toast(`${s.name}: ${SHOP_STATUS[status].toLowerCase()}`);
    },
    onError: (e) => toast(e.message),
  });
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={shopHref(s.id)} className="text-[19px] font-semibold hover:text-leaf">
          {s.name}
        </Link>
        <ShopStatusPill status={s.status} />
        <span className="ml-auto text-[13px] text-secondary">заявка {timeAgo(s.createdAt)}</span>
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[15px]">
        <dt className="text-secondary">ИНН</dt>
        <dd className="flex flex-wrap items-center gap-x-3">
          <span className="font-mono">{s.inn}</span>
          <a href={`https://www.rusprofile.ru/search?query=${s.inn}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium text-leaf">
            Rusprofile <ExternalLink className="size-3.5" aria-hidden />
          </a>
          <a href="https://egrul.nalog.ru/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium text-leaf">
            ЕГРЮЛ <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </dd>
        <dt className="text-secondary">Город</dt>
        <dd>
          {s.city}
          {s.address && `, ${s.address}`}
          {s.delivery && " · доставка"}
        </dd>
        {s.phone && (
          <>
            <dt className="text-secondary">Телефон</dt>
            <dd>{s.phone}</dd>
          </>
        )}
        {s.website && (
          <>
            <dt className="text-secondary">Сайт</dt>
            <dd className="truncate">
              <a href={s.website} target="_blank" rel="noopener noreferrer" className="text-leaf">
                {s.website}
              </a>
            </dd>
          </>
        )}
      </dl>
      {s.description && <p className="mt-2 text-[15px] whitespace-pre-line text-secondary">{s.description}</p>}
      <textarea
        className={cx(inputClass, "mt-3 min-h-16 text-[15px]")}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        placeholder="Комментарий владельцу (необязательно)"
        aria-label={`Комментарий для «${s.name}»`}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {ACTIONS.filter((a) => a.status !== s.status).map((a) => (
          <Button key={a.status} variant={a.variant} className="flex-1" loading={review.isPending && review.variables === a.status} onClick={() => review.mutate(a.status)}>
            {a.label}
          </Button>
        ))}
      </div>
    </Card>
  );
}

function Queue() {
  const profile = useProfile();
  const isAdmin = profile.data?.isAdmin ?? false;
  const queue = useReviewQueue(isAdmin);
  const [filter, setFilter] = useState<ShopStatus | "all">("pending");
  if (profile.isPending) return <Spinner />;
  if (!isAdmin) return <EmptyState icon={ShieldCheck} title="Только для администратора" message="Эта страница нужна для проверки магазинов." />;
  if (queue.isPending) return <Spinner />;
  if (queue.error) return <ErrorNote error={queue.error} onRetry={() => queue.refetch()} />;
  const count = (st: ShopStatus) => queue.data.filter((s) => s.status === st).length;
  const shown = filter === "all" ? queue.data : queue.data.filter((s) => s.status === filter);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {(["pending", "verified", "rejected", "suspended"] as ShopStatus[]).map((st) => (
          <Chip key={st} active={filter === st} onClick={() => setFilter(st)}>
            {SHOP_STATUS[st]} · {count(st)}
          </Chip>
        ))}
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>
          Все · {queue.data.length}
        </Chip>
      </div>
      {shown.length ? shown.map((s) => <ShopReview key={s.id} shop={s} />) : <p className="py-10 text-center text-secondary">Здесь пусто</p>}
    </div>
  );
}

export default function AdminShopsPage() {
  return (
    <>
      <PageHeader eyebrow="Администрирование" title="Проверка магазинов" />
      <RequireSession>
        <Queue />
      </RequireSession>
    </>
  );
}
