/** База знаний в сборке: виды, грунтовые смеси и подкормки из JSON-снимка, поиск и связи между ними. */

import fertRows from "@/data/fertilizers.json";
import soilRows from "@/data/soil-mixes.json";
import rows from "@/data/species.json";
import { fertilizerFromRow, type Fertilizer } from "./domain/fertilizer";
import { soilMixFromRow, type SoilMix } from "./domain/soil";
import { searchLocal, speciesFromRow, speciesNames, type Species } from "./domain/species";

/**
 * База знаний из снимка src/data/species.json (обновляется при сборке скриптом
 * scripts/sync-species.mjs). Витрина и поиск работают мгновенно и без сети;
 * id в снимке = slug, настоящий id вида для записи в базу берёт репозиторий.
 */
export const ALL_SPECIES: Species[] = (rows as Record<string, unknown>[]).map(speciesFromRow);

const bySlug = new Map(ALL_SPECIES.map((s) => [s.slug, s]));
/** Вид по slug (адрес страницы вида); null — нет такого. */
export const speciesBySlug = (slug: string | null | undefined) => (slug ? (bySlug.get(slug) ?? null) : null);
const byId = new Map(ALL_SPECIES.map((s) => [s.id, s]));
/** Вид по id из базы знаний. */
export const speciesById = (id: string | null | undefined) => (id ? (byId.get(id) ?? null) : null);

/** Своё фото растения, а если его нет — фото вида из базы знаний. */
export const plantPhotoUrl = (p: { photoUrl: string | null; speciesSlug: string | null } | null | undefined) =>
  p ? (p.photoUrl ?? speciesBySlug(p.speciesSlug)?.image?.url ?? null) : null;

/** Справочник грунтов из снимка src/data/soil-mixes.json. */
export const ALL_SOIL_MIXES: SoilMix[] = (soilRows as Record<string, unknown>[]).map(soilMixFromRow);
const mixBySlug = new Map(ALL_SOIL_MIXES.map((m) => [m.slug, m]));
const soilMixBySlug = (slug: string | null | undefined) => (slug ? (mixBySlug.get(slug) ?? null) : null);
/** Грунтовая смесь, рекомендованная виду. */
export const soilMixFor = (s: Species | null | undefined) => soilMixBySlug(s?.care?.soilMixSlug);
/** Виды, которым подходит этот грунт. */
export const speciesForMix = (slug: string) => ALL_SPECIES.filter((s) => s.care?.soilMixSlug === slug);

/** Справочник подкормок из снимка src/data/fertilizers.json. */
const ALL_FERTILIZERS: Fertilizer[] = (fertRows as Record<string, unknown>[]).map(fertilizerFromRow);
const fertBySlug = new Map(ALL_FERTILIZERS.map((f) => [f.slug, f]));
/** Программа подкормки, рекомендованная виду. */
export const fertilizerFor = (s: Species | null | undefined) => {
  const slug = s?.care?.fertilizerSlug;
  return slug ? (fertBySlug.get(slug) ?? null) : null;
};

function trigrams(s: string): Set<string> {
  const padded = `  ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
}

/** Похожесть слова запроса на лучшее слово названия (как word_similarity в pg_trgm, упрощённо). */
function similarity(query: string, name: string): number {
  const q = trigrams(query);
  let best = 0;
  for (const word of name.toLowerCase().split(/[\s\-«»"',.]+/)) {
    if (!word) continue;
    const w = trigrams(word);
    let common = 0;
    q.forEach((t) => w.has(t) && common++);
    best = Math.max(best, common / (q.size + w.size - common));
  }
  return best;
}

/** Поиск: сначала точные совпадения и вхождения, при опечатках — похожие названия. */
export function searchSpecies(query: string, all: Species[] = ALL_SPECIES): Species[] {
  const q = query.trim().toLowerCase();
  if (!q) return all;
  const direct = searchLocal(all, q);
  if (direct.length) return direct;
  return all
    .map((s) => ({
      s,
      score: Math.max(...speciesNames(s).map((n) => similarity(q, n))),
    }))
    .filter((x) => x.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.s);
}
