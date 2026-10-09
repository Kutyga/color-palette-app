/** «Новичкам»: курс для начинающих — модули и уроки по порядку; у части уроков есть видео. */

import { ChevronRight, Clock, PlayCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, cx } from "@/components/ui";
import { plural } from "@/lib/format";
import { COURSE, COURSE_LESSONS } from "@/lib/guides";

export const metadata: Metadata = {
  title: "Курс для начинающих — комнатные растения",
  description:
    "Бесплатный курс для новичков: свет, полив, горшок, грунт, пересадка, подкормки, вредители, размножение — видеоуроки и текст.",
};

export default function CoursePage() {
  const ready = COURSE_LESSONS.filter((l) => !l.soon).length;
  const videos = COURSE_LESSONS.filter((l) => !l.soon && l.video).length;
  return (
    <>
      <nav className="text-secondary pt-6 text-[15px]">
        <Link href="/plants/" className="hover:text-label">
          Знания
        </Link>{" "}
        / Новичкам
      </nav>
      <PageHeader eyebrow={`${COURSE.length} модулей · ${COURSE_LESSONS.length} уроков`} title="Курс для новичков" />
      <p className="text-secondary max-w-2xl text-[17px] leading-relaxed">
        Всё, чтобы растения жили долго: от выбора окна до размножения. Уроки идут по порядку, у каждого — текст, а у
        {videos === 1 ? " первого" : " части"} — короткое видео. Готово {ready} {plural(ready, "урок", "урока", "уроков")}, остальные —
        скоро.
      </p>

      <div className="mt-6 space-y-8">
        {COURSE.map((m, mi) => (
          <section key={m.title} aria-label={`Модуль ${mi + 1}: ${m.title}`}>
            <div className="mb-3 flex items-center gap-3">
              <span className="bg-leaf/12 grid size-11 shrink-0 place-items-center rounded-2xl text-[22px]" aria-hidden>
                {m.emoji}
              </span>
              <div>
                <p className="text-secondary text-[12px] font-semibold tracking-wide uppercase">Модуль {mi + 1}</p>
                <h2 className="text-[20px] leading-tight font-bold">{m.title}</h2>
              </div>
            </div>
            <ol className="bg-surface divide-separator divide-y overflow-hidden rounded-[20px]">
              {COURSE_LESSONS.filter((l) => l.module === mi).map((l) =>
                l.soon ? (
                  <li key={l.number} className="flex items-center gap-3 p-4 opacity-60">
                    <span className="text-secondary w-7 shrink-0 text-center font-semibold tabular-nums">{l.number}</span>
                    <span className="min-w-0 flex-1 font-medium">{l.title}</span>
                    <span className="bg-muted text-secondary rounded-full px-2.5 py-0.5 text-[12px] font-semibold">скоро</span>
                  </li>
                ) : (
                  <li key={l.number}>
                    <Link href={`/plants/guide/${l.guide.slug}/`} className="flex items-center gap-3 p-4">
                      <span className={cx("w-7 shrink-0 text-center font-semibold tabular-nums", l.video ? "text-leaf" : "text-secondary")}>
                        {l.number}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block leading-snug font-semibold">{l.guide.title}</span>
                        <span className="text-secondary mt-0.5 flex items-center gap-3 text-[13px]">
                          {l.video && (
                            <span className="text-leaf inline-flex items-center gap-1 font-semibold">
                              <PlayCircle className="size-3.5" aria-hidden /> Видео {l.video.duration}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3.5" aria-hidden /> {l.guide.minutes} мин чтения
                          </span>
                        </span>
                      </span>
                      <ChevronRight className="text-secondary size-5 shrink-0" aria-hidden />
                    </Link>
                  </li>
                ),
              )}
            </ol>
          </section>
        ))}
      </div>
    </>
  );
}
