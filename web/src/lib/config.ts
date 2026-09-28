/** Настройки сборки. Publishable-ключ предназначен для браузера: доступ к данным ограничивают RLS-политики. */
const RAW_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
/**
 * Адрес API. Относительный («/api» — свой сервер на SpaceWeb) дополняется адресом страницы:
 * сайт работает и по http, и по https без пересборки.
 */
export const SUPABASE_URL = RAW_URL.startsWith("/") && typeof window !== "undefined" ? window.location.origin + RAW_URL : RAW_URL;
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const hasBackend = Boolean(SUPABASE_URL && SUPABASE_KEY);
/** Realtime (веб-сокеты) есть только у Supabase; на своём хостинге (SpaceWeb) новые сообщения чата — опросом. */
export const HAS_REALTIME = /\.supabase\.co\/?$/.test(SUPABASE_URL);

/** Префикс адреса, если сайт лежит не в корне домена (GitHub Pages: /color-palette-app). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
