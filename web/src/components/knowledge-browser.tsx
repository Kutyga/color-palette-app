"use client";

/** Каталог видов: поиск, подборки и карточки видов с пометкой «безопасно для животных». */

import { PawPrint, Search, SearchX } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { COLLECTIONS, DIFFICULTY_LABELS, speciesName, type Species } from "@/lib/domain/species";
import { searchSpecies } from "@/lib/knowledge";
import { Chip, EmptyState, PlantPhoto } from "./ui";

export function SpeciesCard({ s }: { s: Species }) {
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

/** Огромное поле поиска и витрина подборок, как на apple.com. */
export function KnowledgeBrowser() {
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState<string | null>(null);
  const deferred = useDeferredValue(query);
  const filter = COLLECTIONS.find((c) => c.id === collection);
  const results = searchSpecies(deferred).filter((s) => !filter || filter.test(s));

  return (
    <>
      <div className="relative">
        <Search className="text-secondary pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Монстера, фикус, калатея…"
          aria-label="Поиск по базе знаний"
          className="bg-muted placeholder:text-secondary focus:ring-leaf w-full rounded-2xl py-4 pr-4 pl-12 text-[19px] outline-none focus:ring-2"
        />
      </div>
      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
        <Chip active={!collection} onClick={() => setCollection(null)}>
          Все
        </Chip>
        {COLLECTIONS.map((c) => (
          <Chip key={c.id} active={collection === c.id} onClick={() => setCollection(collection === c.id ? null : c.id)}>
            {c.title}
          </Chip>
        ))}
      </div>
      {filter && <p className="text-secondary mt-3 text-[15px]">{filter.subtitle}</p>}
      {results.length === 0 ? (
        <EmptyState icon={SearchX} title="Ничего не нашли" message="Попробуйте латинское или другое народное название." />
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {results.map((s) => (
            <SpeciesCard key={s.slug} s={s} />
          ))}
        </div>
      )}
    </>
  );
}
