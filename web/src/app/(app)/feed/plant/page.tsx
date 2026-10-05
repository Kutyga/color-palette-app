"use client";

/** Растение и его дневник: фото, вид, заметки хозяина и все записи в хронологическом порядке. */

import { BookOpen, ChevronRight, NotebookPen } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { RequireSession } from "@/components/app-shell";
import { BackLink } from "@/components/back-link";
import { CommentsSheet, DiaryCard, SpeciesLink } from "@/components/feed";
import { personHref } from "@/components/people";
import { EmptyState, ErrorNote, PageHeader, PlantPhoto, Spinner } from "@/components/ui";
import { catalogBySlug } from "@/lib/catalog";
import type { PlantProfile } from "@/lib/domain/people";
import type { FeedPost } from "@/lib/domain/social";
import { plural } from "@/lib/format";
import { usePlantDiary, usePlantProfile } from "@/lib/queries";

const dayMonth = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

/** Сколько прошло между первым и последним фото: «3 недели», «4 месяца». */
function span(from: Date, to: Date): string {
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  if (days < 14) return `${days} ${plural(days, "день", "дня", "дней")}`;
  if (days < 60) {
    const w = Math.round(days / 7);
    return `${w} ${plural(w, "неделю", "недели", "недель")}`;
  }
  const m = Math.round(days / 30);
  return `${m} ${plural(m, "месяц", "месяца", "месяцев")}`;
}

/** «Было → стало»: первое и последнее фото растения рядом. */
function BeforeAfter({ entries }: { entries: FeedPost[] }) {
  const photos = entries.filter((p) => p.photoUrl);
  if (photos.length < 2) return null;
  const before = photos[0];
  const after = photos[photos.length - 1];
  // Снимки одного дня — сравнивать нечего.
  if (after.createdAt.getTime() - before.createdAt.getTime() < 86_400_000) return null;
  return (
    <section aria-label="Было и стало" className="bg-surface mb-6 rounded-[20px] p-3">
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["Было", before],
            ["Стало", after],
          ] as const
        ).map(([label, post]) => (
          <figure key={label}>
            <PlantPhoto
              src={post.photoUrl}
              seed={post.id}
              alt={`${label}: ${dayMonth(post.createdAt)}`}
              className="aspect-square w-full rounded-2xl"
              sizes="50vw"
            />
            <figcaption className="mt-1.5 text-center text-[13px]">
              <b>{label}</b> <span className="text-secondary">· {dayMonth(post.createdAt)}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="text-leaf mt-2 text-center text-[14px] font-semibold">🌿 Так выросло за {span(before.createdAt, after.createdAt)}</p>
    </section>
  );
}

const monthYear = (d: Date) => d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

/** Шапка: фото, имя, вид, чьё растение и заметки хозяина. */
function PlantHeader({ plant, entries }: { plant: PlantProfile; entries: number }) {
  const sp = catalogBySlug(plant.speciesSlug);
  return (
    <section aria-label="О растении" className="bg-surface mb-6 rounded-[20px] p-3">
      <div className="flex gap-3">
        <PlantPhoto
          src={plant.photoUrl ?? sp?.image?.url}
          seed={plant.id}
          alt={plant.nickname}
          className="size-24 shrink-0 rounded-2xl"
          iconSize={32}
          sizes="96px"
        />
        <div className="min-w-0 flex-1 py-1">
          <h2 className="truncate text-[20px] leading-tight font-bold">{plant.nickname}</h2>
          {sp && <SpeciesLink speciesId={sp.id} className="mt-0.5 max-w-full text-[14px]" />}
          <p className="text-secondary mt-1 text-[13px]">
            {plant.mine ? (
              "Ваше растение"
            ) : (
              <Link href={personHref(plant.ownerName)} className="text-label font-semibold">
                {plant.ownerDisplayName}
              </Link>
            )}{" "}
            · с {monthYear(plant.since)} · {entries} {plural(entries, "запись", "записи", "записей")}
          </p>
        </div>
      </div>
      {plant.notes && <p className="mt-3 px-1 text-[15px] leading-relaxed whitespace-pre-line">{plant.notes}</p>}
      {plant.mine && (
        <Link
          href={`/garden/plant/?id=${encodeURIComponent(plant.id)}`}
          className="text-leaf mt-3 flex items-center gap-1 px-1 text-[14px] font-semibold"
        >
          Карточка ухода <ChevronRight className="size-4" aria-hidden />
        </Link>
      )}
    </section>
  );
}

/** Дневник одного растения: записи от первой к последней — видно, как оно росло. */
function PlantDiary() {
  const id = useSearchParams().get("id");
  const diary = usePlantDiary(id);
  const plant = usePlantProfile(id);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  if (!id) return <EmptyState icon={BookOpen} title="Дневник не найден" message="Ссылка неполная." />;
  if (diary.isPending || plant.isPending) return <Spinner />;
  if (diary.error) return <ErrorNote error={diary.error} onRetry={() => diary.refetch()} />;
  const entries = diary.data;
  const first = entries[0];
  // Растение может быть скрыто, а записи о нём — открыты: тогда шапку собираем из записи.
  const info = plant.data ?? null;
  const mine = info?.mine ?? first?.mine ?? false;
  if (!info && !first) return <EmptyState icon={BookOpen} title="Растение не найдено" message="Его удалили или хозяин скрыл его." />;
  return (
    <div className="mx-auto max-w-xl">
      {info && <PlantHeader plant={info} entries={entries.length} />}
      {!info && first && (
        <p className="text-secondary mb-4">
          {first.plantName ? <b className="text-label">{first.plantName}</b> : "Растение"} · {first.authorDisplayName} · {entries.length}{" "}
          {plural(entries.length, "запись", "записи", "записей")}
        </p>
      )}
      {!info && first?.speciesId && (
        <div className="-mt-2 mb-4">
          <SpeciesLink speciesId={first.speciesId} className="text-[14px]" />
        </div>
      )}
      <BeforeAfter entries={entries} />
      {entries.length === 0 && !mine ? (
        <p className="text-secondary py-6 text-center">{info?.ownerDisplayName ?? "Хозяин"} пока не писал(а) о нём в дневнике.</p>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="В дневнике пока пусто"
          message="Отмечайте новые листья, пересадки и цветение — через полгода будет видно, как растение выросло."
          action={
            <Link
              href={`/feed/new/?type=diary&plant=${encodeURIComponent(id)}`}
              className="bg-leaf rounded-full px-6 py-3 font-semibold text-white"
            >
              Первая запись
            </Link>
          }
        />
      ) : (
        <ol className="border-separator relative space-y-6 border-l-2 pl-5">
          {entries.map((p) => (
            <li key={p.id} className="relative">
              <span className="bg-leaf ring-bg absolute top-5 -left-[27px] size-3 rounded-full ring-4" aria-hidden />
              <p className="text-secondary mb-2 text-[13px] font-semibold">
                {p.createdAt.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
              </p>
              <DiaryCard post={p} onComments={() => setCommentsFor(p.id)} showPlantLink={false} />
            </li>
          ))}
        </ol>
      )}
      {mine && entries.length > 0 && (
        <Link
          href={`/feed/new/?type=diary&plant=${encodeURIComponent(id)}`}
          className="bg-leaf mt-6 flex items-center justify-center gap-2 rounded-full py-3 font-semibold text-white"
        >
          <NotebookPen className="size-4" aria-hidden /> Новая запись
        </Link>
      )}
      <CommentsSheet postId={commentsFor} onClose={() => setCommentsFor(null)} />
    </div>
  );
}

export default function PlantDiaryPage() {
  return (
    <>
      <div className="pt-4">
        <BackLink href="/feed/" className="text-[15px] font-medium">
          Сообщество
        </BackLink>
      </div>
      <PageHeader title="Растение" />
      <RequireSession>
        <Suspense fallback={<Spinner />}>
          <PlantDiary />
        </Suspense>
      </RequireSession>
    </>
  );
}
