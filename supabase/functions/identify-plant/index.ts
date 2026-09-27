// Edge Function: распознавание растения по фото через Pl@ntNet API (бесплатный тариф).
//
// Запрос (POST, JSON): { "image_base64": "...", "organ": "auto" | "leaf" | "flower" | "fruit" | "bark",
//                       "mode": "species" (по умолчанию) | "diseases" }
// Авторизация: токен вошедшего пользователя в Authorization: Bearer <access_token>.
// Ответ: { "source": "plantnet", "results": [{ name, score, common_names, genus, family }] },
//        для mode = "diseases": { "source": "plantnet", "diseases": [{ eppo, score, name }], "ai": AiDiagnosis | null }
//        — фото одновременно смотрят Pl@ntNet и Google Gemini (ключ gemini_api_key в Vault);
//        если один из них не ответил, возвращается результат другого.
//
// Ключ Pl@ntNet хранится в Vault (plantnet_api_key) и читается RPC get_plantnet_key.
// Квоты: 20 распознаваний в день на пользователя и 450 на проект (у Pl@ntNet — 500).
// Деплой: supabase functions deploy identify-plant --no-verify-jwt (пользователя проверяет сама функция).

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  bytesToBase64,
  GEMINI_FALLBACK_MODEL,
  GEMINI_MODEL,
  geminiRequest,
  geminiUrl,
  isRetryableGeminiStatus,
  toAiDiagnosis,
  type AiDiagnosis,
} from "./gemini.ts";
import { decodeBase64Image, ORGANS, type Organ, plantnetDiseasesUrl, plantnetUrl, toDiseases, toIdentifications } from "./plantnet.ts";

const USER_DAILY_LIMIT = 20;
const TOTAL_DAILY_LIMIT = 450;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const SERVICE_USER = "00000000-0000-0000-0000-00000000000f"; // проверочные вызовы по секрету

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

function adminKey(): string {
  const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keys) {
    const parsed = JSON.parse(keys) as Record<string, string>;
    if (parsed.default) return parsed.default;
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });

/** Pl@ntNet: болезни по фото; 404 — «ничего не нашли». */
async function plantnetDiseases(apiKey: string, form: FormData) {
  const res = await fetch(plantnetDiseasesUrl(apiKey), { method: "POST", body: form, signal: AbortSignal.timeout(20_000) });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  return toDiseases(await res.json());
}

/** Gemini: осмотр растения с объяснением; null — ключа нет (функция работает и без него). */
// deno-lint-ignore no-explicit-any
async function geminiDiagnosis(db: any, image: Uint8Array, plantHint: string | null): Promise<AiDiagnosis | null> {
  const { data: key } = await db.rpc("get_gemini_key");
  if (!key) return null;
  const request = JSON.stringify(geminiRequest(bytesToBase64(image), plantHint));
  const call = (model: string) =>
    fetch(geminiUrl(model), {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key as string },
      body: request,
      signal: AbortSignal.timeout(25_000),
    });
  let res = await call(GEMINI_MODEL);
  if (isRetryableGeminiStatus(res.status)) {
    console.error(`gemini ${GEMINI_MODEL}: HTTP ${res.status}, пробуем ${GEMINI_FALLBACK_MODEL}`);
    res = await call(GEMINI_FALLBACK_MODEL);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  const diagnosis = toAiDiagnosis(await res.json());
  if (!diagnosis) throw new Error("ответ не по схеме");
  return diagnosis;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, adminKey(), { auth: { persistSession: false } });

  // Кто спрашивает: вошедший пользователь или служебная проверка по секрету из Vault.
  let userId: string | null = null;
  const serviceSecret = req.headers.get("x-cron-secret");
  if (serviceSecret) {
    const { data: ok } = await db.rpc("verify_news_ingest_secret", { p_secret: serviceSecret });
    if (ok === true) userId = SERVICE_USER;
  } else {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (token) {
      const { data } = await db.auth.getUser(token);
      userId = data.user?.id ?? null;
    }
  }
  if (!userId) return json({ error: "unauthorized" }, 401);

  let body: { image_base64?: string; image_url?: string; organ?: string; mode?: string; plant_hint?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  let image: Uint8Array;
  try {
    if (body.image_base64) {
      image = decodeBase64Image(body.image_base64);
    } else if (body.image_url && userId === SERVICE_USER) {
      const res = await fetch(body.image_url, { headers: { "user-agent": "MyGardenBot/1.0" } });
      if (!res.ok) throw new Error(`image_url: HTTP ${res.status}`);
      image = new Uint8Array(await res.arrayBuffer());
    } else {
      return json({ error: "image_required" }, 400);
    }
  } catch (e) {
    return json({ error: "bad_image", detail: e instanceof Error ? e.message : String(e) }, 400);
  }
  if (image.length === 0 || image.length > MAX_IMAGE_BYTES) return json({ error: "image_size" }, 413);

  const organ: Organ = ORGANS.includes(body.organ as Organ) ? (body.organ as Organ) : "auto";

  const { data: allowed, error: quotaError } = await db.rpc("consume_identify_quota", {
    p_user: userId,
    p_user_limit: USER_DAILY_LIMIT,
    p_total_limit: TOTAL_DAILY_LIMIT,
  });
  if (quotaError) return json({ error: "quota_check_failed" }, 500);
  if (allowed !== true) return json({ error: "quota_exceeded" }, 429);

  const { data: apiKey } = await db.rpc("get_plantnet_key");
  if (!apiKey) return json({ error: "not_configured" }, 503);

  const diseases = body.mode === "diseases";
  const form = new FormData();
  // Оба метода Pl@ntNet принимают фото в поле images (проверено на живом API).
  form.append("images", new Blob([image], { type: "image/jpeg" }), "plant.jpg");
  form.append("organs", organ);

  if (diseases) {
    const [plantnet, ai] = await Promise.allSettled([
      plantnetDiseases(apiKey as string, form),
      geminiDiagnosis(db, image, body.plant_hint ?? null),
    ]);
    if (plantnet.status === "rejected") console.error(`plantnet diseases: ${plantnet.reason}`);
    if (ai.status === "rejected") console.error(`gemini: ${ai.reason}`);
    const aiResult = ai.status === "fulfilled" ? ai.value : null;
    if (plantnet.status === "rejected" && !aiResult) return json({ error: "upstream" }, 502);
    return json({
      source: "plantnet",
      diseases: plantnet.status === "fulfilled" ? plantnet.value : [],
      ai: aiResult,
    });
  }

  const res = await fetch(plantnetUrl(apiKey as string), { method: "POST", body: form, signal: AbortSignal.timeout(20_000) });
  if (res.status === 404) return json({ source: "plantnet", results: [] }); // «Species not found»
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    console.error(`plantnet identify: HTTP ${res.status} ${detail}`);
    return json({ error: "upstream", status: res.status, detail }, 502);
  }
  const payload = await res.json();
  return json({
    source: "plantnet",
    results: toIdentifications(payload),
    remaining: (payload as { remainingIdentificationRequests?: number }).remainingIdentificationRequests ?? null,
  });
});
