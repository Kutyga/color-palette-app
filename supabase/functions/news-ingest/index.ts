// Edge Function: собирает новости о растениях из RSS/Atom-лент (таблица news_sources)
// и складывает в news_articles через RPC ingest_news.
//
// Запуск по расписанию (pg_cron + pg_net), раз в час:
//   select cron.schedule('news-ingest', '0 * * * *', $$
//     select net.http_post(
//       url := 'https://<project-ref>.supabase.co/functions/v1/news-ingest',
//       headers := jsonb_build_object('x-cron-secret', '<NEWS_INGEST_SECRET>')
//     ) $$);
// Деплой: supabase functions deploy news-ingest --no-verify-jwt
//         supabase secrets set NEWS_INGEST_SECRET=<случайная строка>

import { createClient } from "npm:@supabase/supabase-js@2";
import { isAboutPlants, parseFeed } from "./feed.ts";

const MAX_ITEMS_PER_SOURCE = 30;
const FETCH_TIMEOUT_MS = 15_000;

Deno.serve(async (req) => {
  const secret = Deno.env.get("NEWS_INGEST_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return new Response("forbidden", { status: 403 });
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

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
