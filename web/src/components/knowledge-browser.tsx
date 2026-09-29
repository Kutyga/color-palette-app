"use client";

/**
 * Витрина базы знаний: поиск по лёгкому указателю и подборки. Пока ничего не ищут —
 * показываются группы (их рисует сервер и передаёт в children).
 */

import { Search, SearchX } from "lucide-react";
import { useDeferredValue, useState, type ReactNode } from "react";
import { searchCatalog } from "@/lib/catalog";
import { COLLECTIONS } from "@/lib/domain/species";
import { SpeciesRows } from "./species-list";
import { Chip, EmptyState } from "./ui";

export function KnowledgeBrowser({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState<string | null>(null);
  const deferred = useDeferredValue(query);
  const filter = COLLECTIONS.find((c) => c.id === collection);
  const browsing = !deferred.trim() && !filter;
  const results = browsing ? [] : searchCatalog(deferred).filter((s) => !filter || filter.test(s));

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
      {browsing ? (
        children
      ) : (
        <>
          <p className="text-secondary mt-3 text-[15px]">
            {filter ? `${filter.subtitle} · ` : ""}
            {results.length ? `найдено ${results.length}` : ""}
          </p>
          {results.length === 0 ? (
            <EmptyState icon={SearchX} title="Ничего не нашли" message="Попробуйте латинское или другое народное название." />
          ) : (
            <SpeciesRows species={results} />
          )}
        </>
      )}
    </>
  );
}
