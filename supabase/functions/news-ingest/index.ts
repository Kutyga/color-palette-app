// Edge Function: собирает новости о растениях из RSS/Atom-лент (таблица news_sources)
// и складывает в news_articles через RPC ingest_news.
//
// Вызывается раз в час из pg_cron (миграция *_news_schedule.sql) с заголовком
// x-cron-secret; секрет хранится в Vault и сверяется RPC verify_news_ingest_secret.
// Деплой: supabase functions deploy news-ingest --no-verify-jwt
// (проверку делает сама функция; секретные ключи sb_secret_ не являются JWT).

import { createClient } from "npm:@supabase/supabase-js@2";
import { isAboutPlants, parseFeed } from "./feed.ts";

const MAX_ITEMS_PER_SOURCE = 30;
const FETCH_TIMEOUT_MS = 15_000;

/** Секретный ключ проекта: новый формат (SUPABASE_SECRET_KEYS) или legacy service_role. */
function adminKey(): string {
  const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keys) {
    const parsed = JSON.parse(keys) as Record<string, string>;
    if (parsed.default) return parsed.default;
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

Deno.serve(async (req) => {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, adminKey(), { auth: { persistSession: false } });

  const { data: allowed } = await db.rpc("verify_news_ingest_secret", { p_secret: req.headers.get("x-cron-secret") });
  if (allowed !== true) {
    return new Response("forbidden", { status: 403 });
  }

  const { data: sources, error } = await db
    .from("news_sources")
    .select("id, name, feed_url, filter_keywords")
    .eq("enabled", true);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const report: Record<string, number | string> = {};
  for (const source of sources ?? []) {
    try {
      const res = await fetch(source.feed_url, {
        headers: { "user-agent": "MyGardenNewsBot/1.0 (+https://github.com/Kutyga/color-palette-app)" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      let items = parseFeed(await res.text());
      if (source.filter_keywords) items = items.filter((i) => isAboutPlants(i));
      items = items.slice(0, MAX_ITEMS_PER_SOURCE);

      const { data: inserted, error: rpcError } = await db.rpc("ingest_news", { p_source: source.id, p_items: items });
      if (rpcError) throw new Error(rpcError.message);
      report[source.name] = inserted as number;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      report[source.name] = `error: ${message}`;
      await db.from("news_sources").update({ last_error: message, last_fetched_at: new Date().toISOString() }).eq("id", source.id);
    }
  }

  return Response.json(report);
});
