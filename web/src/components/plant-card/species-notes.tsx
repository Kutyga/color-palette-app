/** Из базы знаний о виде: грунт для пересадки и советы по уходу. */

import { BookOpen } from "lucide-react";
import Link from "next/link";
import { SoilSummary } from "@/components/soil-schematic";
import { SectionTitle } from "@/components/ui";
import type { Species } from "@/lib/domain/species";
import { soilMixFor } from "@/lib/knowledge";

export function SpeciesNotes({ species }: { species: Species }) {
  const soil = soilMixFor(species);
  const tips = species.care?.tipsRu ?? [];
  return (
    <>
      {soil && (
        <>
          <SectionTitle>Грунт для пересадки</SectionTitle>
          <SoilSummary mix={soil} href={`/plants/${species.slug}/#soil`} />
        </>
      )}
      {tips.length > 0 && (
        <>
          <SectionTitle
            action={
              <Link href={`/plants/${species.slug}/`} className="text-leaf flex items-center gap-1 text-[15px] font-semibold">
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
