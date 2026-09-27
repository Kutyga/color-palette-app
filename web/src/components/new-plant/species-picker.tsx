"use client";

/** Выбор вида из базы знаний: поиск по названию; выбранный вид показывается карточкой. */

import { ChevronRight, Search, X } from "lucide-react";
import { useState } from "react";
import { PlantPhoto, cx, inputClass } from "@/components/ui";
import { speciesName, type Species } from "@/lib/domain/species";
import { searchSpecies } from "@/lib/knowledge";

export function SpeciesPicker({ value, onChange }: { value: Species | null; onChange: (s: Species | null) => void }) {
  const [query, setQuery] = useState("");
  if (value) {
    return (
      <div className="bg-muted flex items-center gap-3 rounded-2xl p-3">
        <PlantPhoto src={value.image?.url} seed={value.slug} alt="" className="size-12 rounded-xl" iconSize={20} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{speciesName(value)}</p>
          <p className="text-secondary truncate text-[13px] italic">{value.latinName}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="bg-surface grid size-9 place-items-center rounded-full"
          aria-label="Сменить вид"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }
  const results = query.trim() ? searchSpecies(query).slice(0, 6) : [];
  return (
    <div>
      <div className="relative">
        <Search className="text-secondary pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2" aria-hidden />
        <input
          className={cx(inputClass, "pl-12")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Название: монстера, фикус…"
          aria-label="Вид растения"
        />
      </div>
      {results.length > 0 && (
        <ul className="divide-separator bg-muted mt-2 divide-y overflow-hidden rounded-2xl">
          {results.map((s) => (
            <li key={s.slug}>
              <button
                type="button"
                onClick={() => onChange(s)}
                className="hover:bg-surface flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span className="flex-1">
                  <span className="block font-medium">{speciesName(s)}</span>
                  <span className="text-secondary block text-[13px] italic">{s.latinName}</span>
                </span>
                <ChevronRight className="text-secondary size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && results.length === 0 && (
        <p className="text-secondary mt-2 text-[15px]">Такого вида нет в базе — растение можно добавить и без вида.</p>
      )}
    </div>
  );
}
