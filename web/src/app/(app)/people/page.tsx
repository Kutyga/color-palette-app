"use client";

import { Search, SearchX } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { RequireSession } from "@/components/app-shell";
import { PersonRow } from "@/components/people";
import { EmptyState, ErrorNote, PageHeader, Spinner } from "@/components/ui";
import { usePeopleSearch } from "@/lib/queries";

function PeopleSearch() {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const people = usePeopleSearch(deferred);
  return (
    <div className="mx-auto max-w-xl">
      <div className="relative">
        <Search className="text-secondary pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Имя или @username"
          aria-label="Поиск садоводов"
          autoCapitalize="none"
          className="bg-muted placeholder:text-secondary focus:ring-leaf w-full rounded-2xl py-4 pr-4 pl-12 text-[19px] outline-none focus:ring-2"
        />
      </div>
      <h2 className="text-secondary mt-6 mb-1 text-[13px] font-semibold tracking-wide uppercase">
        {deferred.trim() ? "Результаты" : "Популярные садоводы"}
      </h2>
      {people.isPending ? (
        <Spinner />
      ) : people.error ? (
        <ErrorNote error={people.error} onRetry={() => people.refetch()} />
      ) : people.data.length === 0 ? (
        <EmptyState icon={SearchX} title="Никого не нашли" message="Проверьте написание или поищите по @username." />
      ) : (
        <ul className="divide-separator bg-surface divide-y rounded-[20px] px-4">
          {people.data.map((p) => (
            <PersonRow key={p.id} person={p} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PeoplePage() {
  return (
    <>
      <PageHeader title="Садоводы" />
      <RequireSession>
        <PeopleSearch />
      </RequireSession>
    </>
  );
}
