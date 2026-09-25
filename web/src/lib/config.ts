/** Настройки сборки. Publishable-ключ предназначен для браузера: доступ к данным ограничивают RLS-политики. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const hasBackend = Boolean(SUPABASE_URL && SUPABASE_KEY);

/** Префикс адреса, если сайт лежит не в корне домена (GitHub Pages: /color-palette-app). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
