// Edge Function: «режим чтения» для новостей — открывает статью прямо на сайте.
//
// Запрос (POST, JSON): { "id": "<news_articles.id>" }, токен вошедшего пользователя.
// Ответ: { url, title, byline, siteName, lang, blocks: [{ type, text | src }] }.
//
// Скачиваем только адреса из news_articles — функция не становится открытым прокси.
// Деплой: supabase functions deploy news-reader (JWT проверяет платформа).

import { createClient } from "npm:@supabase/supabase-js@2";
import { extractArticle } from "./extract.ts";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 3 * 1024 * 1024;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};
/** Публичный ключ проекта: legacy anon или новый publishable. */
function publicKey(): string {
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (anon) return anon;
  return (JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}") as Record<string, string>).default;
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { ...cors, "Cache-Control": "private, max-age=3600" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let id: unknown;
  try {
    ({ id } = await req.json());
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "bad_id" }, 400);

  // Запрос от имени пользователя: RLS решает, видна ли ему эта новость.
  const db = createClient(Deno.env.get("SUPABASE_URL")!, publicKey(), {
    global: { headers: { Authorization: req.headers.get("authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: article } = await db.from("news_articles").select("url, title, language").eq("id", id).maybeSingle();
  if (!article) return json({ error: "not_found" }, 404);

  try {
    const res = await fetch(article.url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; MyGardenReader/1.0; +https://kutyga.github.io/color-palette-app/)",
        accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return json({ error: "source_unavailable", status: res.status }, 502);
    if (!(res.headers.get("content-type") ?? "").includes("html")) return json({ error: "not_html" }, 422);
    if (Number(res.headers.get("content-length") ?? 0) > MAX_HTML_BYTES) return json({ error: "too_large" }, 422);
    const html = await res.text();
    if (html.length > MAX_HTML_BYTES) return json({ error: "too_large" }, 422);

    const parsed = extractArticle(html, res.url || article.url);
    if (!parsed) return json({ error: "no_article" }, 422);
    return json({
      url: article.url,
      ...parsed,
      title: parsed.title || article.title,
      lang: parsed.lang ?? article.language,
    });
  } catch (e) {
    return json({ error: "fetch_failed", message: e instanceof Error ? e.message : String(e) }, 502);
  }
});
