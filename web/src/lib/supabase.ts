/** Клиент Supabase; null, если сайт собран без адреса проекта (тогда работает только демо). */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL, hasBackend } from "./config";
import { resilientFetch } from "./net";

let client: SupabaseClient | null = null;

/** Один клиент на вкладку; сессия хранится в localStorage и обновляется сама. */
export function supabase(): SupabaseClient {
  if (!hasBackend) throw new Error("Supabase не настроен");
  client ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    // Если Supabase недоступен напрямую (блокировка у оператора) — запросы идут через свой домен.
    global: { fetch: resilientFetch },
  });
  return client;
}
