"use client";

import { useEffect, useState } from "react";

/**
 * Перевод прямо на странице встроенным переводчиком браузера (Translator API, Chrome 138+):
 * работает на устройстве, без ключей и серверов. Где API нет — сайт предлагает Google Переводчик.
 */
interface BrowserTranslator {
  translate(text: string): Promise<string>;
}
interface TranslatorStatic {
  availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
  create(o: { sourceLanguage: string; targetLanguage: string }): Promise<BrowserTranslator>;
}

const api = (): TranslatorStatic | null =>
  typeof self !== "undefined" && "Translator" in self ? (self as unknown as { Translator: TranslatorStatic }).Translator : null;

export const hasBrowserTranslator = () => api() !== null;

const cache = new Map<string, Promise<BrowserTranslator | null>>();

async function translator(source: string, target: string): Promise<BrowserTranslator | null> {
  const t = api();
  if (!t || source === target) return null;
  const key = `${source}>${target}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      t
        .availability({ sourceLanguage: source, targetLanguage: target })
        .then((a) => (a === "unavailable" ? null : t.create({ sourceLanguage: source, targetLanguage: target })))
        .catch(() => null),
    );
  }
  return cache.get(key)!;
}

export type TranslateState = "off" | "working" | "done" | "unsupported";

/** Переводит список строк; пока перевода нет или он невозможен — возвращает исходные. */
export function useTranslated(texts: string[], source: string | null, target: string, enabled: boolean) {
  const [result, setResult] = useState<{ key: string; texts: string[]; state: TranslateState }>({
    key: "",
    texts,
    state: "off",
  });
  const key = `${source}>${target}:${texts.join("\u0001")}`;
  const active = enabled && !!source && source.slice(0, 2) !== target.slice(0, 2);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => {
      const t = await translator(source!.slice(0, 2), target);
      if (cancelled) return;
      if (!t) {
        setResult({ key, texts, state: "unsupported" });
        return;
      }
      setResult({ key, texts, state: "working" });
      const out: string[] = [];
      for (const s of texts) out.push(s ? await t.translate(s).catch(() => s) : s);
      if (!cancelled) setResult({ key, texts: out, state: "done" });
    })();
    return () => {
      cancelled = true;
    };
    // key описывает texts, source и target
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active]);

  if (!active) return { texts, state: "off" as TranslateState };
  if (result.key !== key) return { texts, state: "working" as TranslateState };
  return result;
}

/** Настройки новостей хранятся в браузере. */
export interface NewsPrefs {
  langs: string[];
  target: string;
  autoTranslate: boolean;
}

const PREFS_KEY = "moi-sad-news";
export const DEFAULT_NEWS_PREFS: NewsPrefs = { langs: [], target: "ru", autoTranslate: true };

export function loadNewsPrefs(): NewsPrefs {
  try {
    return { ...DEFAULT_NEWS_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") };
  } catch {
    return DEFAULT_NEWS_PREFS;
  }
}

export function saveNewsPrefs(p: NewsPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // приватный режим — настройки проживут до перезагрузки
  }
}
