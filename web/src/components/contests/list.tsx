"use client";

/** Список розыгрышей: закреплённые конкурсы «Подоконника» сверху, баннер закреплённого в барахолке. */

import { Gift, Pin, Plus, Trophy, Truck, Users } from "lucide-react";
import Link from "next/link";
import { EmptyState, ErrorNote, PlantPhoto, Spinner, cx } from "@/components/ui";
import { contestPhase, type Contest } from "@/lib/domain/contest";
import { plural, timeLeft } from "@/lib/format";
import { useContests } from "@/lib/queries";

export const contestHref = (id: string) => `/market/contest/?id=${encodeURIComponent(id)}`;

/** «Осталось 2 дн. 5 ч» / «Подводим итоги» / «Итоги подведены». */
export function PhaseLabel({ contest: c, now = new Date() }: { contest: Contest; now?: Date }) {
  const phase = contestPhase(c, now);
  if (phase === "active") return <>Осталось {timeLeft(c.endsAt, now)}</>;
  if (phase === "drawing") return <>Подводим итоги…</>;
  if (phase === "cancelled") return <>Отменён</>;
  return <>Итоги подведены</>;
}

function ContestCard({ contest: c }: { contest: Contest }) {
  const active = c.status === "active";
  return (
    <li>
      <Link
        href={contestHref(c.id)}
        className={cx(
          "bg-surface flex gap-3 rounded-[20px] p-3 transition hover:brightness-[0.98]",
          c.pinned && "ring-leaf/40 ring-2",
          !active && "opacity-70",
        )}
      >
        <PlantPhoto src={c.photoUrl} seed={c.id} alt="" className="size-20 shrink-0 rounded-2xl" iconSize={28} />
        <div className="min-w-0 flex-1">
          <p className="text-secondary flex items-center gap-1 text-[12px] font-medium">
            {c.pinned && <Pin className="text-leaf size-3.5" aria-label="Закреплено" />}
            {c.pinned ? "Подоконник" : c.organizerDisplayName} · <PhaseLabel contest={c} />
          </p>
          <p className="truncate text-[17px] font-semibold">{c.title}</p>
          <p className="text-secondary flex items-center gap-1 truncate text-[13px]">
            <Gift className="size-3.5 shrink-0" aria-hidden /> {c.prize}
          </p>
          <p className="text-secondary mt-1 flex items-center gap-3 text-[12px]">
            <span className="flex items-center gap-1">
              <Users className="size-3.5" aria-hidden /> {c.participants}
            </span>
            <span className="flex items-center gap-1">
              <Trophy className="size-3.5" aria-hidden /> {c.winnersCount}
            </span>
            <span className="truncate">{c.city}</span>
            {c.delivery && <Truck className="size-3.5 shrink-0" aria-label="С доставкой" />}
            {c.joined && <span className="text-leaf ml-auto shrink-0 font-semibold">Вы участвуете</span>}
          </p>
        </div>
      </Link>
    </li>
  );
}

/** Вкладка «Конкурсы» барахолки. */
export function ContestsList() {
  const list = useContests();
  const newLink = (
    <Link href="/market/contest/new/" className="bg-leaf inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-semibold text-white">
      <Plus className="size-4" aria-hidden /> Провести розыгрыш
    </Link>
  );
  if (list.isPending) return <Spinner />;
  if (list.error) return <ErrorNote error={list.error} onRetry={() => list.refetch()} />;
  if (!list.data.length)
    return <EmptyState icon={Gift} title="Розыгрышей пока нет" message="Разыграйте черенок или детку — это бесплатно." action={newLink} />;
  const active = list.data.filter((c) => c.status === "active").length;
  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-secondary text-[13px]">
          {active} {plural(active, "розыгрыш идёт", "розыгрыша идут", "розыгрышей идут")} · участие бесплатное, шансы у всех равны
        </p>
        {newLink}
      </div>
      <ul className="space-y-3" aria-label="Розыгрыши">
        {list.data.map((c) => (
          <ContestCard key={c.id} contest={c} />
        ))}
      </ul>
    </>
  );
}

/** Закреплённый конкурс «Подоконника» над объявлениями — в какой бы вкладке барахолки ни был человек. */
export function PinnedContestBanner() {
  const list = useContests();
  const pinned = list.data?.find((c) => c.pinned && c.status === "active");
  if (!pinned) return null;
  return (
    <Link
      href={contestHref(pinned.id)}
      className="bg-leaf/10 mb-3 flex items-center gap-3 rounded-2xl px-4 py-3"
      aria-label={`Закреплённый розыгрыш: ${pinned.title}`}
    >
      <Pin className="text-leaf size-5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">🎉 {pinned.title}</span>
        <span className="text-secondary block truncate text-[13px]">
          {pinned.prize} · <PhaseLabel contest={pinned} />
        </span>
      </span>
    </Link>
  );
}
