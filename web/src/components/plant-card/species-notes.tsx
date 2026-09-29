"use client";

/**
 * Из базы знаний о виде: грунт для пересадки и советы по уходу. Полные данные базы знаний
 * подгружаются отдельным файлом только здесь — остальным страницам хватает лёгкого указателя.
 */

import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { SoilSummary } from "@/components/soil-schematic";
import { SectionTitle } from "@/components/ui";

async function loadNotes(slug: string) {
  const kb = await import("@/lib/knowledge");
  const species = kb.speciesBySlug(slug);
  return { soil: kb.soilMixFor(species), tips: species?.care?.tipsRu ?? [] };
}

export function SpeciesNotes({ slug }: { slug: string }) {
  const notes = useQuery({ queryKey: ["species-notes", slug], queryFn: () => loadNotes(slug), staleTime: Infinity });
  if (!notes.data) return null;
  const { soil, tips } = notes.data;
  return (
    <>
      {soil && (
        <>
          <SectionTitle>Грунт для пересадки</SectionTitle>
          <SoilSummary mix={soil} href={`/plants/${slug}/#soil`} />
        </>
      )}
      {tips.length > 0 && (
        <>
          <SectionTitle
            action={
              <Link href={`/plants/${slug}/`} className="text-leaf flex items-center gap-1 text-[15px] font-semibold">
                <BookOpen className="size-4" aria-hidden /> Всё о виде
              </Link>
            }
          >
            Советы
          </SectionTitle>
          <ul className="bg-surface space-y-2 rounded-[20px] p-4">
            {tips.map((t) => (
              <li key={t} className="flex gap-3 text-[15px]">
                <span className="bg-leaf mt-2 size-1.5 shrink-0 rounded-full" aria-hidden /> {t}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
