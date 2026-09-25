"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ExternalLink, Languages } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { RequireSession } from "@/components/app-shell";
import { useNewsPrefs } from "@/components/news";
import { Spinner } from "@/components/ui";
import { NEWS_LANGUAGES, translatedUrl, type NewsArticle, type ReaderBlock } from "@/lib/domain/social";
import { timeAgo } from "@/lib/format";
import { useReader } from "@/lib/queries";
import { hasBrowserTranslator, useTranslated } from "@/lib/translate";

/** Новость из уже загруженного списка — заголовок и источник видны сразу, пока грузится текст. */
function useCachedArticle(id: string): NewsArticle | undefined {
  const qc = useQueryClient();
  for (const [, list] of qc.getQueriesData<NewsArticle[]>({ queryKey: ["news"] })) {
    const hit = list?.find((a) => a.id === id);
    if (hit) return hit;
  }
  return undefined;
}

function Blocks({ blocks, texts, lang }: { blocks: ReaderBlock[]; texts: string[]; lang: string }) {
  let i = 0;
  return (
    <div className="space-y-4 text-[18px] leading-relaxed" lang={lang}>
      {blocks.map((b, k) => {
        if (b.type === "img") {
          return (
            // eslint-disable-next-line @next/next/no-img-element -- картинки со страницы источника
            <img key={k} src={b.src} alt={b.alt} className="w-full rounded-2xl" loading="lazy" referrerPolicy="no-referrer" />
          );
        }
        const text = texts[i++] ?? b.text;
        if (b.type === "h") return <h2 key={k} className="pt-2 text-[22px] font-semibold">{text}</h2>;
        if (b.type === "li") return <p key={k} className="flex gap-3"><span className="mt-3 size-1.5 shrink-0 rounded-full bg-leaf" />{text}</p>;
        if (b.type === "quote") return <blockquote key={k} className="border-l-4 border-leaf pl-4 italic text-secondary">{text}</blockquote>;
        return <p key={k}>{text}</p>;
      })}
    </div>
  );
}

function Reader({ id }: { id: string }) {
  const meta = useCachedArticle(id);
  const reader = useReader(id);
  const [prefs] = useNewsPrefs();
  const url = reader.data?.url ?? meta?.url;
  const lang = (reader.data?.lang ?? meta?.language ?? "ru").slice(0, 2);
  const foreign = lang !== prefs.target;
  const blocks = reader.data?.blocks ?? [];
  const title = reader.data?.title ?? meta?.title ?? "";
  const source = [title, ...blocks.filter((b) => b.type !== "img").map((b) => ("text" in b ? b.text : ""))];
  const { texts, state } = useTranslated(source, lang, prefs.target, prefs.autoTranslate && foreign && !!reader.data);
  const shownLang = state === "done" ? prefs.target : lang;

  return (
    <article className="mx-auto max-w-2xl pt-4">
      <Link href="/feed/?tab=news" className="inline-flex items-center gap-1 text-[17px] text-leaf">
        <ChevronLeft className="size-5" aria-hidden /> Новости
      </Link>
      <p className="mt-6 text-[13px] text-secondary">
        {reader.data?.siteName ?? meta?.sourceName}
        {meta && ` · ${timeAgo(meta.publishedAt)}`}
        {reader.data?.byline && ` · ${reader.data.byline}`}
      </p>
      <h1 className="mt-2 text-[32px] leading-tight font-bold tracking-tight" lang={shownLang}>
        {state === "done" ? texts[0] : title}
      </h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {foreign && url && (
          <a
            href={translatedUrl(url, prefs.target)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-leaf px-4 py-2 text-[15px] font-semibold text-white"
          >
            <Languages className="size-4" aria-hidden /> Открыть в переводе
          </a>
        )}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-muted px-4 py-2 text-[15px] font-semibold"
          >
            <ExternalLink className="size-4" aria-hidden /> Сайт источника
          </a>
        )}
      </div>
      {foreign && (
        <p className="mt-3 text-[13px] text-secondary">
          Язык статьи: {NEWS_LANGUAGES[lang] ?? lang}.{" "}
          {state === "working" && "Переводим…"}
          {state === "done" && `Переведено браузером на ${NEWS_LANGUAGES[prefs.target]?.toLowerCase() ?? prefs.target}.`}
          {(state === "unsupported" || (state === "off" && !hasBrowserTranslator())) &&
            "Браузер не переводит сам — нажмите «Открыть в переводе» или воспользуйтесь переводом страницы в меню браузера."}
        </p>
      )}

      <div className="mt-8">
        {reader.isPending ? (
          <Spinner label="Загружаем статью…" />
        ) : reader.data ? (
          <Blocks blocks={blocks} texts={state === "done" ? texts.slice(1) : []} lang={shownLang} />
        ) : (
          <div className="rounded-[20px] bg-surface p-5">
            <p className="font-semibold">Текст статьи здесь недоступен</p>
            <p className="mt-1 text-[15px] text-secondary">
              {reader.error
                ? "Сайт источника не отдал статью — откройте её по кнопке выше."
                : "В демо-режиме статьи открываются на сайте источника."}
            </p>
            {meta?.summary && <p className="mt-4 text-[17px] leading-relaxed">{meta.summary}</p>}
          </div>
        )}
      </div>
    </article>
  );
}

function ArticleInner() {
  const id = useSearchParams().get("id");
  if (!id) return <p className="pt-10 text-center text-secondary">Статья не найдена</p>;
  return <Reader id={id} />;
}

export default function ArticlePage() {
  return (
    <RequireSession>
      <Suspense fallback={<Spinner />}>
        <ArticleInner />
      </Suspense>
    </RequireSession>
  );
}
