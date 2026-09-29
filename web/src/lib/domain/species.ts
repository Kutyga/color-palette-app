/** Вид растения из базы знаний: профиль ухода, фото, поиск по названиям, подборки. */

import type { LightLevel } from "./care";
import { speciesGroupId } from "./groups";

export interface CareProfile {
  light: LightLevel | null;
  waterIntervalSummer: number;
  waterIntervalWinter: number;
  drynessRu: string | null;
  humidityMinPct: number | null;
  tempMinC: number | null;
  tempMaxC: number | null;
  fertilizeIntervalDays: number | null;
  fertilizeMonths: number[];
  repotEveryYears: number | null;
  propagation: string[];
  tipsRu: string[];
  /** Состав грунта — slug из справочника soil_mixes (см. domain/soil.ts). */
  soilMixSlug: string | null;
  /** Поправка к составу именно для этого вида. */
  soilNoteRu: string | null;
  /** Программа подкормки — slug из справочника fertilizers (см. domain/fertilizer.ts). */
  fertilizerSlug: string | null;
}

/** Популярный сорт вида: название, русская транскрипция и чем отличается. */
export interface Cultivar {
  name: string;
  ru: string | null;
  note: string | null;
}

/** Фото вида с Wikimedia Commons; автора и лицензию обязательно показываем рядом. */
export interface SpeciesImage {
  url: string;
  credit: string | null;
  license: string | null;
  sourceUrl: string | null;
}

/**
 * Краткая запись вида — для списков, поиска и подписей. Лёгкий указатель
 * (src/data/species-index.json) грузится на любой странице, полные данные — только где нужны.
 */
export interface SpeciesSummary {
  id: string;
  slug: string;
  latinName: string;
  commonNamesRu: string[];
  commonNamesEn: string[];
  synonyms: string[];
  plantType: string | null;
  difficulty: number | null;
  toxicToPets: boolean | null;
  airPurifying: boolean | null;
  image: { url: string } | null;
  light: LightLevel | null;
  /** Группа витрины (см. domain/groups.ts). */
  group: string;
  cultivars: { name: string; ru: string | null }[];
}

export interface Species extends SpeciesSummary {
  descriptionRu: string | null;
  toxicToHumans: boolean | null;
  image: SpeciesImage | null;
  care: CareProfile | null;
  cultivars: Cultivar[];
}

/** Русское народное название, если есть, иначе латинское. */
export const speciesName = (s: Pick<SpeciesSummary, "commonNamesRu" | "latinName">) => s.commonNamesRu[0] ?? s.latinName;

type Row = Record<string, unknown>;
const ru = (v: unknown) => ((v as { ru?: unknown } | null)?.ru ?? null) as never;

export function careFromRow(r: Row): CareProfile {
  return {
    light: (r.light as LightLevel | null) ?? null,
    waterIntervalSummer: Number(r.water_interval_summer),
    waterIntervalWinter: Number(r.water_interval_winter),
    drynessRu: ru(r.soil_dryness_before_watering),
    humidityMinPct: (r.humidity_min_pct as number | null) ?? null,
    tempMinC: (r.temp_min_c as number | null) ?? null,
    tempMaxC: (r.temp_max_c as number | null) ?? null,
    fertilizeIntervalDays: (r.fertilize_interval_days as number | null) ?? null,
    fertilizeMonths: (r.fertilize_months as number[] | null) ?? [],
    repotEveryYears: (r.repot_every_years as number | null) ?? null,
    propagation: (r.propagation as string[] | null) ?? [],
    tipsRu: ru(r.tips) ?? [],
    soilMixSlug: (r.soil_mix_slug as string | null) ?? null,
    soilNoteRu: ru(r.soil_note),
    fertilizerSlug: (r.fertilizer_slug as string | null) ?? null,
  };
}

/** Ожидает выборку `*, care_profiles(*)`. */
export function speciesFromRow(r: Row): Species {
  const names = (r.common_names as { ru?: string[]; en?: string[] } | null) ?? {};
  // PostgREST отдаёт связь 1:1 объектом, но поддерживаем и массив.
  const careRaw = Array.isArray(r.care_profiles) ? r.care_profiles[0] : r.care_profiles;
  const care = careRaw ? careFromRow(careRaw as Row) : null;
  const plantType = (r.plant_type as string | null) ?? null;
  return {
    id: r.id as string,
    slug: r.slug as string,
    latinName: r.latin_name as string,
    commonNamesRu: names.ru ?? [],
    commonNamesEn: names.en ?? [],
    synonyms: (r.synonyms as string[] | null) ?? [],
    descriptionRu: ru(r.description),
    plantType,
    difficulty: (r.difficulty as number | null) ?? null,
    toxicToPets: (r.toxic_to_pets as boolean | null) ?? null,
    toxicToHumans: (r.toxic_to_humans as boolean | null) ?? null,
    airPurifying: (r.air_purifying as boolean | null) ?? null,
    image: r.image_url
      ? {
          url: r.image_url as string,
          credit: (r.image_credit as string | null) ?? null,
          license: (r.image_license as string | null) ?? null,
          sourceUrl: (r.image_source_url as string | null) ?? null,
        }
      : null,
    care,
    light: care?.light ?? null,
    group: speciesGroupId({ latinName: r.latin_name as string, plantType, fertilizerSlug: care?.fertilizerSlug ?? null }),
    cultivars: ((r.cultivars as Partial<Cultivar>[] | null) ?? [])
      .filter((c) => typeof c.name === "string" && c.name)
      .map((c) => ({ name: c.name!, ru: c.ru ?? null, note: c.note ?? null })),
  };
}

/**
 * Строка лёгкого указателя src/data/species-index.json. Его пишет scripts/sync-species.mjs;
 * тест сверяет, что указатель совпадает с полным снимком.
 */
export interface SpeciesIndexRow {
  slug: string;
  latin: string;
  ru: string[];
  en: string[];
  syn: string[];
  cv: [string, string | null][];
  img: string | null;
  diff: number | null;
  pets: boolean | null;
  air: boolean | null;
  light: string | null;
  type: string | null;
  group: string;
}

export const indexRowOf = (s: Species): SpeciesIndexRow => ({
  slug: s.slug,
  latin: s.latinName,
  ru: s.commonNamesRu,
  en: s.commonNamesEn,
  syn: s.synonyms,
  cv: s.cultivars.map((c) => [c.name, c.ru]),
  img: s.image?.url ?? null,
  diff: s.difficulty,
  pets: s.toxicToPets,
  air: s.airPurifying,
  light: s.light,
  type: s.plantType,
  group: s.group,
});

/** id в снимке = slug (см. lib/knowledge.ts). */
export const summaryFromIndexRow = (r: SpeciesIndexRow): SpeciesSummary => ({
  id: r.slug,
  slug: r.slug,
  latinName: r.latin,
  commonNamesRu: r.ru,
  commonNamesEn: r.en,
  synonyms: r.syn,
  plantType: r.type,
  difficulty: r.diff,
  toxicToPets: r.pets,
  airPurifying: r.air,
  image: r.img ? { url: r.img } : null,
  light: r.light as LightLevel | null,
  group: r.group,
  cultivars: r.cv.map(([name, ru]) => ({ name, ru })),
});

/** Только поля краткой записи: страницы передают в браузер меньше данных. */
export const toSummary = (s: Species): SpeciesSummary => summaryFromIndexRow(indexRowOf(s));

/** Все названия вида для поиска: латинское, народные, прежние и названия сортов. */
const speciesNames = (s: SpeciesSummary) => [
  s.latinName,
  ...s.synonyms,
  ...s.commonNamesRu,
  ...s.commonNamesEn,
  ...s.cultivars.flatMap((c) => (c.ru ? [c.name, c.ru] : [c.name])),
];

/** Простое совпадение для демо-режима (на сервере — search_species с опечатками). */
export function speciesMatches(s: SpeciesSummary, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return speciesNames(s).some((n) => n.toLowerCase().includes(q));
}

/** Ранжирование как у search_species: точное название, затем начало, затем вхождение. */
export function searchLocal<T extends SpeciesSummary>(all: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return all;
  const rank = (s: T) => {
    const names = speciesNames(s).map((n) => n.toLowerCase());
    if (names.includes(q)) return 0;
    if (names.some((n) => n.startsWith(q))) return 1;
    return 2;
  };
  return all.filter((s) => speciesMatches(s, q)).sort((a, b) => rank(a) - rank(b) || a.latinName.localeCompare(b.latinName));
}

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
export function searchFuzzy<T extends SpeciesSummary>(all: T[], query: string): T[] {
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

export const DIFFICULTY_LABELS = ["", "Неубиваемое", "Легко", "Средне", "Капризное", "Для экспертов"];

/** Подборки на витрине базы знаний. */
export const COLLECTIONS: { id: string; title: string; subtitle: string; test: (s: SpeciesSummary) => boolean }[] = [
  { id: "pet-safe", title: "Безопасно для кошек", subtitle: "Не ядовиты для питомцев", test: (s) => s.toxicToPets === false },
  {
    id: "shade",
    title: "Для тёмной квартиры",
    subtitle: "Мирятся с тенью и полутенью",
    test: (s) => s.light === "low" || s.light === "medium",
  },
  { id: "easy", title: "Неубиваемые", subtitle: "Простят забывчивость", test: (s) => (s.difficulty ?? 5) <= 1 },
  { id: "air", title: "Очищают воздух", subtitle: "Лучшие для спальни и офиса", test: (s) => s.airPurifying === true },
  { id: "succulents", title: "Суккуленты и кактусы", subtitle: "Полив раз в пару недель", test: (s) => s.plantType === "суккулент" },
];
