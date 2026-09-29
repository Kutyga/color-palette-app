/**
 * Запасной путь к Supabase через свой домен. Часть российских операторов (чаще мобильный
 * интернет) не пропускает *.supabase.co — в браузере это «Load failed» / «Failed to fetch».
 * Тогда запросы идут на {сайт}/sb/…, а хостинг пересылает их в Supabase (spaceweb/sb-proxy).
 * Переключение — само, после первой сетевой ошибки; через сутки снова пробуем напрямую.
 */

import { BASE_PATH, SUPABASE_URL } from "./config";

const FLAG = "podokonnik-sb-proxy";
const RETRY_DIRECT_MS = 24 * 60 * 60 * 1000;

const origin = (() => {
  try {
    return new URL(SUPABASE_URL).origin;
  } catch {
    return "";
  }
})();

/** Прокси только для Supabase на своём домене *.supabase.co (у своего API на SpaceWeb он не нужен). */
const proxyBase = () =>
  origin.endsWith(".supabase.co") && typeof window !== "undefined" ? `${window.location.origin}${BASE_PATH}/sb` : "";

/** Сейчас запросы идут через свой домен. */
export function proxyMode(): boolean {
  try {
    const since = Number(localStorage.getItem(FLAG) ?? 0);
    return since > 0 && Date.now() - since < RETRY_DIRECT_MS;
  } catch {
    return false;
  }
}

function enableProxy() {
  try {
    localStorage.setItem(FLAG, String(Date.now()));
  } catch {
    // хранилище недоступно — прокси будет только для текущего запроса
  }
}

/** Адрес Supabase → адрес через свой домен (если включён запасной путь). */
export function viaProxy(url: string, force = false): string {
  const base = proxyBase();
  return base && (force || proxyMode()) && url.startsWith(origin) ? base + url.slice(origin.length) : url;
}

/** fetch для supabase-js: напрямую, а при сетевой ошибке — через свой домен. */
export const resilientFetch: typeof fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!proxyBase() || !url.startsWith(origin)) return fetch(input, init);
  if (proxyMode()) return fetch(viaProxy(url), init);
  try {
    return await fetch(input, init);
  } catch (e) {
    // TypeError — сеть не дошла до сервера (блокировка, обрыв); отмена запроса (AbortError) — не наш случай.
    if (!(e instanceof TypeError)) throw e;
    const res = await fetch(viaProxy(url, true), init);
    enableProxy();
    return res;
  }
};
