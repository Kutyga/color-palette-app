"use client";

/** Поиск садоводов по имени; без запроса — все садоводы (популярные или новые) порциями. */

import { Search, SearchX } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { RequireSession } from "@/components/app-shell";
import { PersonRow } from "@/components/people";
import { Button, Chip, EmptyState, ErrorNote, PageHeader, Spinner } from "@/components/ui";
import type { PeopleSort } from "@/lib/domain/people";
import { usePeopleSearch } from "@/lib/queries";

const QUERY_KEY = "people-search";
const SORT_KEY = "people-sort";

/** Запрос помнится до закрытия вкладки: после «Назад» из профиля — те же результаты. */
function saved(key: string) {
  try {
    return sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function save(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Без хранилища просто не запоминаем.
  }
}

function PeopleSearch() {
  const [query, setQueryState] = useState(() => saved(QUERY_KEY));
  const [sort, setSortState] = useState<PeopleSort>(() => (saved(SORT_KEY) === "new" ? "new" : "popular"));
  const setQuery = (q: string) => {
    setQueryState(q);
    save(QUERY_KEY, q);
  };
  const setSort = (s: PeopleSort) => {
    setSortState(s);
    save(SORT_KEY, s);
  };
  const deferred = useDeferredValue(query);
  const searching = deferred.trim() !== "";
  const people = usePeopleSearch(deferred, searching ? "popular" : sort);
  const list = people.data?.pages.flat() ?? [];
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
      {searching ? (
        <h2 className="text-secondary mt-6 mb-1 text-[13px] font-semibold tracking-wide uppercase">Результаты</h2>
      ) : (
        <div className="mt-5 mb-3 flex gap-2" role="group" aria-label="Порядок">
          <Chip active={sort === "popular"} onClick={() => setSort("popular")}>
            Популярные
          </Chip>
          <Chip active={sort === "new"} onClick={() => setSort("new")}>
            Новые
          </Chip>
        </div>
      )}
      {people.isPending ? (
        <Spinner />
      ) : people.error ? (
        <ErrorNote error={people.error} onRetry={() => people.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon={SearchX} title="Никого не нашли" message="Проверьте написание или поищите по @username." />
      ) : (
        <>
          <ul className="divide-separator bg-surface divide-y rounded-[20px] px-4">
            {list.map((p) => (
              <PersonRow key={p.id} person={p} />
            ))}
          </ul>
          {people.hasNextPage && (
            <Button variant="secondary" className="mt-4 w-full" loading={people.isFetchingNextPage} onClick={() => people.fetchNextPage()}>
              Показать ещё
            </Button>
          )}
        </>
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
