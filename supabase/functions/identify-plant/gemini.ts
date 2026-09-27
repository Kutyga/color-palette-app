// Осмотр растения по фото через Google Gemini (бесплатный тариф). Без зависимостей: работает
// в Deno и в Node (тесты). Модель выбирает причины из того же справочника, что и сайт
// (web/src/lib/domain/diagnosis.ts — CAUSES), поэтому советы на сайте одни и те же.

export const GEMINI_MODEL = "gemini-flash-latest";
/** На бесплатном тарифе основная модель бывает перегружена (503) — тогда пробуем облегчённую. */
export const GEMINI_FALLBACK_MODEL = "gemini-flash-lite-latest";
/** Ответы, после которых есть смысл попробовать запасную модель. */
export const isRetryableGeminiStatus = (status: number) => status === 429 || status === 500 || status === 503;

/** id причин из справочника сайта; «other» — проблема вне справочника. */
export const CAUSE_IDS = [
  "overwatering", "root_rot", "underwatering", "dry_air", "low_light", "sunburn", "natural_aging", "hunger",
  "stress", "spider_mite", "mealybug", "scale", "thrips", "aphids", "fungus_gnats", "powdery_mildew",
  "leaf_spot", "grey_mould",
] as const;

export interface AiProblem {
  cause: string; // один из CAUSE_IDS или «other»
  title: string;
  confidence: number; // 0…1
  evidence: string;
}

export interface AiDiagnosis {
  isPlant: boolean;
  healthy: boolean;
  plant: string | null;
  summary: string;
  problems: AiProblem[];
}

export function geminiUrl(model = GEMINI_MODEL): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

const INSTRUCTION = `Ты — опытный агроном по комнатным растениям. Осмотри фото и определи болезни, вредителей и ошибки ухода.
Правила:
- Отвечай по-русски, коротко и по делу, без воды.
- Не выдумывай: если явных признаков проблем нет — healthy = true и пустой список problems.
- Если на фото нет растения — is_plant = false, healthy = false, problems пустой, в summary попроси сфотографировать растение.
- Для каждой проблемы поле cause — одно из: ${CAUSE_IDS.join(", ")}; если ни одно не подходит — other.
- title — название проблемы по-русски; evidence — что именно видно на фото; confidence — уверенность от 0 до 1.
- Не больше трёх проблем, самые вероятные первыми.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    is_plant: { type: "BOOLEAN" },
    healthy: { type: "BOOLEAN" },
    plant: { type: "STRING", nullable: true },
    summary: { type: "STRING" },
    problems: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          cause: { type: "STRING", enum: [...CAUSE_IDS, "other"] },
          title: { type: "STRING" },
          confidence: { type: "NUMBER" },
          evidence: { type: "STRING" },
        },
        required: ["cause", "title", "confidence", "evidence"],
      },
    },
  },
  required: ["is_plant", "healthy", "summary", "problems"],
};

/** Тело запроса generateContent: фото, подсказка о растении (если известно) и схема ответа. */
export function geminiRequest(imageBase64: string, plantHint?: string | null) {
  const hint = plantHint?.trim() ? `Владелец говорит, что это: ${plantHint.trim().slice(0, 120)}.` : "Вид растения неизвестен.";
  return {
    systemInstruction: { parts: [{ text: INSTRUCTION }] },
    contents: [
      {
        role: "user",
        parts: [{ inline_data: { mime_type: "image/jpeg", data: imageBase64 } }, { text: `${hint} Что с растением?` }],
      },
    ],
    generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.2, maxOutputTokens: 1024 },
  };
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Ответ generateContent → проверенный диагноз; null — ответа нет или он не по схеме. */
export function toAiDiagnosis(body: unknown): AiDiagnosis | null {
  const text = (body as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("");
  if (!text) return null;
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const known = new Set<string>(CAUSE_IDS);
  const problems = (Array.isArray(raw.problems) ? raw.problems : [])
    .map((p): AiProblem | null => {
      const item = p as Record<string, unknown>;
      const title = str(item.title, 120);
      if (!title) return null;
      const cause = typeof item.cause === "string" && known.has(item.cause) ? item.cause : "other";
      const confidence = typeof item.confidence === "number" && Number.isFinite(item.confidence) ? Math.max(0, Math.min(1, item.confidence)) : 0.5;
      return { cause, title, confidence, evidence: str(item.evidence, 400) };
    })
    .filter((p): p is AiProblem => p !== null)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
  const isPlant = raw.is_plant !== false;
  return {
    isPlant,
    healthy: isPlant && raw.healthy === true && problems.length === 0,
    plant: str(raw.plant, 120) || null,
    summary: str(raw.summary, 600),
    problems: isPlant ? problems : [],
  };
}

/** Байты → base64 порциями (без переполнения стека на больших фото). */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
