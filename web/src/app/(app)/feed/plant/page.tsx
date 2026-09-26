"use client";

import { BookOpen, ChevronLeft, NotebookPen } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { RequireSession } from "@/components/app-shell";
import { CommentsSheet, DiaryCard } from "@/components/feed";
import { EmptyState, ErrorNote, PageHeader, Spinner } from "@/components/ui";
import { plural } from "@/lib/format";
import { usePlantDiary } from "@/lib/queries";

/** Дневник одного растения: записи от первой к последней — видно, как оно росло. */
function PlantDiary() {
  const id = useSearchParams().get("id");
  const diary = usePlantDiary(id);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  if (!id) return <EmptyState icon={BookOpen} title="Дневник не найден" message="Ссылка неполная." />;
  if (diary.isPending) return <Spinner />;
  if (diary.error) return <ErrorNote error={diary.error} onRetry={() => diary.refetch()} />;
  const entries = diary.data;
  const first = entries[0];
  const mine = first?.mine ?? true;
  return (
    <div className="mx-auto max-w-xl">
      {first && (
        <p className="mb-4 text-secondary">
          {first.plantName ? <b className="text-label">{first.plantName}</b> : "Растение"} · {first.authorDisplayName} ·{" "}
          {entries.length} {plural(entries.length, "запись", "записи", "записей")}
        </p>
      )}
      {entries.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="В дневнике пока пусто"
          message="Отмечайте новые листья, пересадки и цветение — через полгода будет видно, как растение выросло."
          action={
            <Link href={`/feed/new/?type=diary&plant=${encodeURIComponent(id)}`} className="rounded-full bg-leaf px-6 py-3 font-semibold text-white">
              Первая запись
            </Link>
          }
        />
      ) : (
        <ol className="relative space-y-6 border-l-2 border-separator pl-5">
          {entries.map((p) => (
            <li key={p.id} className="relative">
              <span className="absolute top-5 -left-[27px] size-3 rounded-full bg-leaf ring-4 ring-bg" aria-hidden />
              <p className="mb-2 text-[13px] font-semibold text-secondary">
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
          className="mt-6 flex items-center justify-center gap-2 rounded-full bg-leaf py-3 font-semibold text-white"
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
        <Link href="/feed/" className="inline-flex items-center gap-1 text-[15px] font-medium text-leaf">
          <ChevronLeft className="size-5" aria-hidden /> Сообщество
        </Link>
      </div>
      <PageHeader title="Дневник растения" />
      <RequireSession>
        <Suspense fallback={<Spinner />}>
          <PlantDiary />
        </Suspense>
      </RequireSession>
    </>
  );
}
