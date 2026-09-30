"use client";

/** «Мой дневник»: все свои записи о растениях и советы, новые сверху; фильтр по растению. */

import { BookOpen, ChevronRight, NotebookPen } from "lucide-react";
import Link from "next/link";
import { Suspense, useState } from "react";
import { RequireSession } from "@/components/app-shell";
import { BackLink } from "@/components/back-link";
import { CommentsSheet, DiaryCard, plantDiaryHref } from "@/components/feed";
import { Chip, EmptyState, ErrorNote, PageHeader, Spinner } from "@/components/ui";
import { plural } from "@/lib/format";
import { useMyDiary } from "@/lib/queries";

/** Фильтр: все записи, записи одного растения (его id) или только советы. */
type Filter = "all" | "tips" | { plantId: string };

function MyDiary() {
  const diary = useMyDiary();
  const [filter, setFilter] = useState<Filter>("all");
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  if (diary.isPending) return <Spinner />;
  if (diary.error) return <ErrorNote error={diary.error} onRetry={() => diary.refetch()} />;

  const all = diary.data;
  const tips = all.filter((p) => p.event === "tip");
  // Растения — в порядке последней записи о них.
  const plants = [
    ...new Map(all.filter((p) => p.plantId && p.event !== "tip").map((p) => [p.plantId!, p.plantName ?? "Растение"])).entries(),
  ];
  const plantId = typeof filter === "object" ? filter.plantId : null;
  const shown = filter === "all" ? all : filter === "tips" ? tips : all.filter((p) => p.plantId === plantId && p.event !== "tip");
  const entries = all.length - tips.length;

  if (!all.length) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Дневник пока пуст"
        message="Отмечайте новые листья, пересадки и цветение — здесь соберётся история ваших растений."
        action={
          <Link href="/feed/new/?type=diary" className="bg-leaf rounded-full px-6 py-3 font-semibold text-white">
            Первая запись
          </Link>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <p className="text-secondary mb-3">
        {entries} {plural(entries, "запись", "записи", "записей")} · {plants.length}{" "}
        {plural(plants.length, "растение", "растения", "растений")}
        {tips.length > 0 && ` · ${tips.length} ${plural(tips.length, "совет", "совета", "советов")}`}
      </p>
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>
          Все
        </Chip>
        {plants.map(([id, name]) => (
          <Chip key={id} active={plantId === id} onClick={() => setFilter({ plantId: id })}>
            {name}
          </Chip>
        ))}
        {tips.length > 0 && (
          <Chip active={filter === "tips"} onClick={() => setFilter("tips")}>
            💡 Советы
          </Chip>
        )}
      </div>
      {plantId && (
        <Link
          href={plantDiaryHref(plantId)}
          className="bg-surface text-leaf mb-4 flex items-center gap-2 rounded-2xl px-4 py-3 font-semibold"
        >
          <BookOpen className="size-4" aria-hidden /> Дневник растения: было → стало
          <ChevronRight className="ml-auto size-4" aria-hidden />
        </Link>
      )}
      <div className="space-y-4">
        {shown.map((p) => (
          <DiaryCard key={p.id} post={p} onComments={() => setCommentsFor(p.id)} showPlantLink={!plantId} />
        ))}
      </div>
      <Link
        href="/feed/new/?type=diary"
        className="bg-leaf mt-6 flex items-center justify-center gap-2 rounded-full py-3 font-semibold text-white"
      >
        <NotebookPen className="size-4" aria-hidden /> Новая запись
      </Link>
      <CommentsSheet postId={commentsFor} onClose={() => setCommentsFor(null)} />
    </div>
  );
}

export default function MyDiaryPage() {
  return (
    <>
      <div className="pt-4">
        <BackLink href="/profile/" className="text-[15px] font-medium">
          Профиль
        </BackLink>
      </div>
      <PageHeader title="Мой дневник" />
      <RequireSession>
        <Suspense fallback={<Spinner />}>
          <MyDiary />
        </Suspense>
      </RequireSession>
    </>
  );
}
