// Одноразовая служебная функция: скачивает открытую модель распознавания растений
// Google AIY Vision «plants V1» (TFLite, ~2100 видов, Apache-2.0) и её список меток
// в публичный бакет ml-models, откуда приложение загружает модель на телефон.
// Вызов защищён тем же секретом, что и news-ingest. После загрузки функцию можно удалить.

import { createClient } from "npm:@supabase/supabase-js@2";

const SOURCES = {
  model: [
    "https://tfhub.dev/google/lite-model/aiy/vision/classifier/plants_V1/3?lite-format=tflite",
    "https://storage.googleapis.com/tfhub-lite-models/google/lite-model/aiy/vision/classifier/plants_V1/3.tflite",
  ],
  labels: ["https://www.gstatic.com/aihub/tfhub/labelmaps/aiy_plants_V1_labelmap.csv"],
};

function adminKey(): string {
  const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keys) {
    const parsed = JSON.parse(keys) as Record<string, string>;
    if (parsed.default) return parsed.default;
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

async function download(urls: string[]): Promise<{ bytes: Uint8Array; url: string }> {
  const errors: string[] = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { bytes: new Uint8Array(await res.arrayBuffer()), url };
    } catch (e) {
      errors.push(`${url}: ${e instanceof Error ? e.message : e}`);
    }
  }
  throw new Error(errors.join("; "));
}

Deno.serve(async (req) => {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, adminKey(), { auth: { persistSession: false } });
  const { data: allowed } = await db.rpc("verify_news_ingest_secret", { p_secret: req.headers.get("x-cron-secret") });
  if (allowed !== true) return new Response("forbidden", { status: 403 });

  try {
    const model = await download(SOURCES.model);
    const labels = await download(SOURCES.labels);
    const bucket = db.storage.from("ml-models");
    for (const [path, file, type] of [
      ["plants_v1.tflite", model.bytes, "application/octet-stream"],
      ["plants_v1_labels.csv", labels.bytes, "text/csv"],
    ] as const) {
      const { error } = await bucket.upload(path, file, { contentType: type, upsert: true });
      if (error) throw new Error(`${path}: ${error.message}`);
    }

    // Какие виды базы знаний модель умеет узнавать.
    const csv = new TextDecoder().decode(labels.bytes);
    const names = csv.split("\n").slice(1).map((l) => l.split(",").slice(1).join(",").trim().toLowerCase()).filter(Boolean);
    const { data: species } = await db.from("species").select("latin_name, synonyms");
    const known = (species ?? []).map((s) => ({
      latin: s.latin_name,
      found: [s.latin_name, ...(s.synonyms ?? [])].some((n: string) => names.includes(n.toLowerCase())),
      genus: names.some((n) => n.startsWith(s.latin_name.split(" ")[0].toLowerCase() + " ")),
    }));

    return Response.json({
      model: { url: model.url, bytes: model.bytes.length },
      labels: { url: labels.url, count: names.length, sample: names.slice(0, 5) },
      knowledge_base: known,
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
});
