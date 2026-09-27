// Edge Function: Web Push-уведомления в браузер.
//
// POST {"action":"config"} — открытый VAPID-ключ для подписки браузера (без авторизации:
//   ключ публичный). При первом вызове функция сама генерирует пару ключей и кладёт её
//   в Vault (push_store_vapid_keys) — закрытый ключ не покидает сервер.
// POST {"action":"send"} + заголовок x-cron-secret — разослать очередь private.push_queue.
//   Вызывается раз в минуту из pg_cron (миграция *_water_culture_and_push.sql), секрет в Vault.
// Деплой: supabase functions deploy push --no-verify-jwt (проверку делает сама функция).

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUBJECT = "https://github.com/Kutyga/color-palette-app";
const TTL_SECONDS = 12 * 3600;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });

function adminKey(): string {
  const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keys) {
    const parsed = JSON.parse(keys) as Record<string, string>;
    if (parsed.default) return parsed.default;
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

type Keys = { publicKey: string; privateKey: string };

async function vapidKeys(db: SupabaseClient): Promise<Keys> {
  const read = async () => {
    const { data, error } = await db.rpc("push_vapid_keys");
    if (error) throw new Error(error.message);
    const row = (data as { public_key: string | null; private_key: string | null }[])[0];
    return row?.public_key && row.private_key ? { publicKey: row.public_key, privateKey: row.private_key } : null;
  };
  const existing = await read();
  if (existing) return existing;
  const fresh = webpush.generateVAPIDKeys();
  const { error } = await db.rpc("push_store_vapid_keys", { p_public: fresh.publicKey, p_private: fresh.privateKey });
  if (error) throw new Error(error.message);
  // Если параллельный вызов успел раньше — берём сохранённую им пару.
  return (await read()) ?? fresh;
}

type Item = {
  id: number;
  title: string;
  body: string;
  url: string;
  tag: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  subscription_id: string;
};

async function send(db: SupabaseClient) {
  const keys = await vapidKeys(db);
  webpush.setVapidDetails(SUBJECT, keys.publicKey, keys.privateKey);
  const { data, error } = await db.rpc("push_take_batch", { p_limit: 200 });
  if (error) throw new Error(error.message);
  const items = (data ?? []) as Item[];
  const ok: string[] = [];
  const gone: string[] = [];
  const failed: string[] = [];
  await Promise.all(
    items.map(async (it) => {
      const payload = JSON.stringify({ title: it.title, body: it.body, url: it.url, tag: it.tag });
      try {
        await webpush.sendNotification({ endpoint: it.endpoint, keys: { p256dh: it.p256dh, auth: it.auth } }, payload, {
          TTL: TTL_SECONDS,
          urgency: "high",
        });
        ok.push(it.subscription_id);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410 — браузер отписался или подписка устарела.
        if (status === 404 || status === 410) gone.push(it.subscription_id);
        else failed.push(`${status ?? "?"}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200));
      }
    }),
  );
  if (ok.length || gone.length) {
    const { error: reportError } = await db.rpc("push_report", { p_ok: ok, p_gone: gone });
    if (reportError) throw new Error(reportError.message);
  }
  return { sent: ok.length, gone: gone.length, failed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, adminKey(), { auth: { persistSession: false } });
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };

  try {
    if (action === "config") {
      return json({ publicKey: (await vapidKeys(db)).publicKey });
    }
    if (action === "send") {
      const { data: allowed } = await db.rpc("push_verify_secret", { p_secret: req.headers.get("x-cron-secret") });
      if (allowed !== true) return json({ error: "forbidden" }, 403);
      return json(await send(db));
    }
    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
