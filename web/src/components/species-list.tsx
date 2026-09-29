/**
 * Виды в списках базы знаний: компактная строка, карточка с фото и плитка группы.
 * Без состояния — рисуются и на сервере (страницы групп), и в браузере (поиск).
 */

import { ChevronRight, PawPrint } from "lucide-react";
import Link from "next/link";
import type { SpeciesGroup } from "@/lib/domain/groups";
import { DIFFICULTY_LABELS, speciesName, type SpeciesSummary } from "@/lib/domain/species";
import { PlantPhoto } from "./ui";

/** Строка списка: миниатюра, название, латынь, сложность и «безопасно для животных». */
function SpeciesRow({ s }: { s: SpeciesSummary }) {
  return (
    <li>
      <Link href={`/plants/${s.slug}/`} className="hover:bg-muted flex items-center gap-3 rounded-2xl p-2 transition">
        <PlantPhoto src={s.image?.url} seed={s.slug} alt="" className="size-14 shrink-0 rounded-xl" iconSize={20} sizes="56px" />
        <div className="min-w-0 flex-1">
          <p className="truncate leading-snug font-semibold">{speciesName(s)}</p>
          <p className="text-secondary truncate text-[13px] italic">{s.latinName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-[12px] font-medium">
          {s.toxicToPets === false && (
            <span className="bg-leaf/15 text-leaf grid size-6 place-items-center rounded-full" title="Безопасно для животных">
              <PawPrint className="size-3.5" aria-label="Безопасно для животных" />
            </span>
          )}
          {s.difficulty != null && (
            <span className="bg-muted hidden rounded-full px-2 py-0.5 sm:inline">{DIFFICULTY_LABELS[s.difficulty]}</span>
          )}
        </div>
      </Link>
    </li>
  );
}

/** Список строк в одну колонку на телефоне и в две — на широком экране. */
export function SpeciesRows({ species }: { species: SpeciesSummary[] }) {
  return (
    <ul className="mt-4 grid gap-x-4 gap-y-1 md:grid-cols-2">
      {species.map((s) => (
        <SpeciesRow key={s.slug} s={s} />
      ))}
    </ul>
  );
}

/** Карточка с крупным фото — «Похожие растения» на странице вида. */
export function SpeciesCard({ s }: { s: SpeciesSummary }) {
  return (
    <Link href={`/plants/${s.slug}/`} className="group bg-surface block overflow-hidden rounded-[20px]">
      <div className="overflow-hidden">
        <PlantPhoto
          src={s.image?.url}
          seed={s.slug}
          alt=""
          className="aspect-[4/3] w-full transition group-hover:scale-[1.03]"
          iconSize={36}
        />
      </div>
      <div className="p-4">
        <p className="leading-snug font-semibold">{speciesName(s)}</p>
        <p className="text-secondary truncate text-[13px] italic">{s.latinName}</p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[12px] font-medium">
          {s.difficulty != null && <span className="bg-muted rounded-full px-2 py-0.5">{DIFFICULTY_LABELS[s.difficulty]}</span>}
          {s.toxicToPets === false && (
            <span className="bg-leaf/15 text-leaf inline-flex items-center gap-1 rounded-full px-2 py-0.5">
              <PawPrint className="size-3" aria-hidden /> безопасно
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/** Плитка группы на витрине: обложка (вид из species-groups.json или первый с фото), название и число видов. */
export function GroupTile({ group, species }: { group: SpeciesGroup; species: SpeciesSummary[] }) {
  const cover = (species.find((s) => s.slug === group.cover && s.image) ?? species.find((s) => s.image))?.image?.url;
  return (
    <Link href={`/plants/group/${group.id}/`} className="group bg-surface flex items-center gap-3 overflow-hidden rounded-[20px] p-2 pr-3">
      <PlantPhoto src={cover} seed={group.id} alt="" className="size-16 shrink-0 rounded-2xl" iconSize={24} sizes="64px" />
      <div className="min-w-0 flex-1">
        <p className="leading-snug font-semibold">{group.title}</p>
        <p className="text-secondary line-clamp-2 text-[13px] leading-snug">{group.subtitle}</p>
      </div>
      <span className="text-secondary flex shrink-0 items-center text-[13px] font-medium">
        {species.length}
        <ChevronRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}
