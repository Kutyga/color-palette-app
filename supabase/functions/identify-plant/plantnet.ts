// Разбор ответа Pl@ntNet API v2 без зависимостей: работает в Deno и в Node (тесты).

export interface Identification {
  name: string; // латинское название без автора, «Monstera deliciosa»
  score: number; // 0…1
  common_names: string[];
  genus: string | null;
  family: string | null;
}

export const ORGANS = ["auto", "leaf", "flower", "fruit", "bark"] as const;
export type Organ = (typeof ORGANS)[number];

export function plantnetUrl(apiKey: string, lang = "ru", results = 5): string {
  const params = new URLSearchParams({
    "api-key": apiKey,
    lang,
    "nb-results": String(results),
    "include-related-images": "false",
  });
  return `https://my-api.plantnet.org/v2/identify/all?${params}`;
}

export function toIdentifications(body: unknown): Identification[] {
  const results = (body as { results?: unknown[] })?.results;
  if (!Array.isArray(results)) return [];
  const out: Identification[] = [];
  for (const r of results) {
    const item = r as {
      score?: number;
      species?: {
        scientificNameWithoutAuthor?: string;
        commonNames?: string[];
        genus?: { scientificNameWithoutAuthor?: string };
        family?: { scientificNameWithoutAuthor?: string };
      };
    };
    const name = item.species?.scientificNameWithoutAuthor?.trim();
    if (!name || typeof item.score !== "number") continue;
    out.push({
      name,
      score: Math.max(0, Math.min(1, item.score)),
      common_names: (item.species?.commonNames ?? []).filter((n) => typeof n === "string").slice(0, 3),
      genus: item.species?.genus?.scientificNameWithoutAuthor ?? null,
      family: item.species?.family?.scientificNameWithoutAuthor ?? null,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** base64 (с префиксом data: или без) → байты. */
export function decodeBase64Image(value: string): Uint8Array {
  const clean = value.replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]+=*$/.test(clean)) throw new Error("image_base64 не похоже на base64");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
