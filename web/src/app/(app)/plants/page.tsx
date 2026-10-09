/** База знаний: поиск, подборки, статьи для новичков и группы видов комнатных растений. */

import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { KnowledgeBrowser } from "@/components/knowledge-browser";
import { GroupTile } from "@/components/species-list";
import { PageHeader } from "@/components/ui";
import { CATALOG, CATALOG_GROUPS } from "@/lib/catalog";
import { plural } from "@/lib/format";
import { COURSE, COURSE_LESSONS } from "@/lib/guides";

export const metadata: Metadata = {
  title: "База знаний",
  description: `Уход за ${CATALOG.length} комнатными растениями по группам — ароидные, калатеи, суккуленты, орхидеи, пальмы: свет, полив летом и зимой, влажность, подкормки и токсичность для питомцев.`,
};

export default function PlantsPage() {
  return (
    <>
      <PageHeader eyebrow={`${CATALOG.length} растений`} title="Знания" />
      <KnowledgeBrowser>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link href="/plants/guide/" className="bg-leaf flex items-center gap-3 rounded-[20px] p-4 text-white">
            <span className="text-[28px]" aria-hidden>
              🌱
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-semibold">Новичкам</span>
              <span className="block text-[13px] leading-snug opacity-90">
                Курс: {COURSE.length} модулей, {COURSE_LESSONS.length} {plural(COURSE_LESSONS.length, "урок", "урока", "уроков")} — видео и
                текст
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0" aria-hidden />
          </Link>
          <Link href="/plants/soil/" className="bg-surface flex items-center gap-3 rounded-[20px] p-4">
            <span className="text-[28px]" aria-hidden>
              🟤
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-semibold">Грунты</span>
              <span className="text-secondary block text-[13px] leading-snug">Рецепты смесей со схемами для каждого вида</span>
            </span>
            <ChevronRight className="text-secondary size-5 shrink-0" aria-hidden />
          </Link>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATALOG_GROUPS.map(({ group, species }) => (
            <GroupTile key={group.id} group={group} species={species} />
          ))}
        </div>
      </KnowledgeBrowser>
    </>
  );
}
