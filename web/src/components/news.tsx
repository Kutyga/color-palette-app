"use client";

import { Languages, Newspaper, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { NEWS_LANGUAGES, translatedUrl, type NewsArticle } from "@/lib/domain/social";
import { timeAgo } from "@/lib/format";
import { useNews } from "@/lib/queries";
import { DEFAULT_NEWS_PREFS, hasBrowserTranslator, loadNewsPrefs, saveNewsPrefs, useTranslated, type NewsPrefs } from "@/lib/translate";
import { Chip, EmptyState, ErrorNote, Sheet, Spinner, useIsClient } from "./ui";

export function useNewsPrefs(): [NewsPrefs, (p: NewsPrefs) => void] {
  const isClient = useIsClient();
  const [prefs, setPrefs] = useState<NewsPrefs | null>(null);
  const current = prefs ?? (isClient ? loadNewsPrefs() : DEFAULT_NEWS_PREFS);
  return [
    current,
    (p) => {
      saveNewsPrefs(p);
      setPrefs(p);
    },
  ];
}

function NewsItem({ a, prefs }: { a: NewsArticle; prefs: NewsPrefs }) {
  const foreign = a.language !== prefs.target;
  const { texts, state } = useTranslated([a.title, a.summary ?? ""], a.language, prefs.target, prefs.autoTranslate && foreign);
  const [title, summary] = texts;
  // Статьи из базы знаний (демо) — внутренние ссылки; остальные открываются в режиме чтения на сайте.
  const href = a.url.startsWith("/") ? a.url : `/feed/article/?id=${a.id}`;
  return (
    <article className="rounded-[20px] bg-surface transition hover:brightness-[0.98]">
      <Link href={href} className="flex gap-4 p-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[13px] text-secondary">
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold uppercase">{a.language}</span>
            {a.sourceName} · {timeAgo(a.publishedAt)}
            {state === "done" && <Languages className="size-3.5 text-leaf" aria-label="Переведено" />}
          </p>
          <h3 className="mt-1 text-[17px] leading-snug font-semibold" lang={state === "done" ? prefs.target : a.language}>
            {title}
          </h3>
          {summary && (
            <p className="mt-1 line-clamp-2 text-[15px] text-secondary" lang={state === "done" ? prefs.target : a.language}>
              {summary}
            </p>
          )}
        </div>
        {a.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- картинки с сайтов-источников
          <img src={a.imageUrl} alt="" className="size-24 shrink-0 rounded-2xl object-cover" loading="lazy" referrerPolicy="no-referrer" />
        )}
      </Link>
      {foreign && !a.url.startsWith("/") && (
        <div className="flex gap-4 border-t border-separator px-4 py-2 text-[13px] font-medium">
          <a href={translatedUrl(a.url, prefs.target)} target="_blank" rel="noopener noreferrer" className="text-leaf">
            Открыть в переводе
          </a>
          <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-secondary">
            Оригинал
          </a>
        </div>
      )}
    </article>
  );
}

function NewsSettings({ prefs, onChange }: { prefs: NewsPrefs; onChange: (p: NewsPrefs) => void }) {
  const toggle = (code: string) =>
    onChange({ ...prefs, langs: prefs.langs.includes(code) ? prefs.langs.filter((l) => l !== code) : [...prefs.langs, code] });
  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-semibold">Языки новостей</h3>
        <p className="text-[13px] text-secondary">Ничего не выбрано — показываем все.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(NEWS_LANGUAGES).map(([code, name]) => (
            <Chip key={code} active={prefs.langs.includes(code)} onClick={() => toggle(code)}>
              {name}
            </Chip>
          ))}
        </div>
      </section>
      <section>
        <h3 className="font-semibold">Перевод</h3>
        <label className="mt-3 flex items-center justify-between gap-4 rounded-2xl bg-muted px-4 py-3">
          <span>Переводить автоматически</span>
          <input
            type="checkbox"
            checked={prefs.autoTranslate}
            onChange={(e) => onChange({ ...prefs, autoTranslate: e.target.checked })}
            className="size-5 accent-[var(--leaf)]"
          />
        </label>
        <label className="mt-2 flex items-center justify-between gap-4 rounded-2xl bg-muted px-4 py-3">
          <span>На язык</span>
          <select
            value={prefs.target}
            onChange={(e) => onChange({ ...prefs, target: e.target.value })}
            className="rounded-lg bg-surface px-2 py-1"
            aria-label="Язык перевода"
          >
            {Object.entries(NEWS_LANGUAGES).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-[13px] text-secondary">
          {hasBrowserTranslator()
            ? "Ваш браузер переводит прямо на странице, без отправки текста на сервер."
            : "Этот браузер не умеет переводить сам — у зарубежных статей будет кнопка «Открыть в переводе» (Google Переводчик). В Safari можно также нажать «аА» → «Перевести»."}
        </p>
      </section>
    </div>
  );
}

export function News() {
  const [onlyMine, setOnlyMine] = useState(false);
  const [prefs, setPrefs] = useNewsPrefs();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const news = useNews(onlyMine, prefs.langs);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="no-scrollbar -mx-4 mb-3 flex items-center gap-2 overflow-x-auto px-4">
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-4 py-2 text-[13px] font-medium"
          aria-label="Настройки новостей"
        >
          <SlidersHorizontal className="size-4" aria-hidden /> Язык и перевод
        </button>
        <Chip active={prefs.langs.length === 0} onClick={() => setPrefs({ ...prefs, langs: [] })}>
          Все языки
        </Chip>
        {Object.entries(NEWS_LANGUAGES).map(([code, name]) => (
          <Chip
            key={code}
            active={prefs.langs.length === 1 && prefs.langs[0] === code}
            onClick={() => setPrefs({ ...prefs, langs: [code] })}
          >
            {name}
          </Chip>
        ))}
      </div>
      <label className="mb-4 flex items-center justify-between rounded-[20px] bg-surface px-4 py-3">
        <span className="font-medium">Только про мои растения</span>
        <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} className="size-5 accent-[var(--leaf)]" />
      </label>
      {news.isPending ? (
        <Spinner />
      ) : news.error ? (
        <ErrorNote error={news.error} onRetry={() => news.refetch()} />
      ) : news.data.length === 0 ? (
        <EmptyState icon={Newspaper} title="Новостей пока нет" message="Попробуйте другой язык — сбор новостей идёт каждый час." />
      ) : (
        <div className="space-y-3">
          {news.data.map((a) => (
            <NewsItem key={a.id} a={a} prefs={prefs} />
          ))}
        </div>
      )}
      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Новости">
        <NewsSettings prefs={prefs} onChange={setPrefs} />
      </Sheet>
    </div>
  );
}
