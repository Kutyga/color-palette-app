import type { LightLevel } from "./care";

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
}

/** Фото вида с Wikimedia Commons; автора и лицензию обязательно показываем рядом. */
export interface SpeciesImage {
  url: string;
  credit: string | null;
  license: string | null;
  sourceUrl: string | null;
}

export interface Species {
  id: string;
  slug: string;
  latinName: string;
  commonNamesRu: string[];
  commonNamesEn: string[];
  synonyms: string[];
  descriptionRu: string | null;
  plantType: string | null;
  difficulty: number | null;
  toxicToPets: boolean | null;
  toxicToHumans: boolean | null;
  airPurifying: boolean | null;
  image: SpeciesImage | null;
  care: CareProfile | null;
}

/** Русское народное название, если есть, иначе латинское. */
export const speciesName = (s: Pick<Species, "commonNamesRu" | "latinName">) =>
  s.commonNamesRu[0] ?? s.latinName;

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
  };
}

/** Ожидает выборку `*, care_profiles(*)`. */
export function speciesFromRow(r: Row): Species {
  const names = (r.common_names as { ru?: string[]; en?: string[] } | null) ?? {};
  // PostgREST отдаёт связь 1:1 объектом, но поддерживаем и массив.
  const careRaw = Array.isArray(r.care_profiles) ? r.care_profiles[0] : r.care_profiles;
  return {
    id: r.id as string,
    slug: r.slug as string,
    latinName: r.latin_name as string,
    commonNamesRu: names.ru ?? [],
    commonNamesEn: names.en ?? [],
    synonyms: (r.synonyms as string[] | null) ?? [],
    descriptionRu: ru(r.description),
    plantType: (r.plant_type as string | null) ?? null,
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
    care: careRaw ? careFromRow(careRaw as Row) : null,
  };
}

/** Простое совпадение для демо-режима (на сервере — search_species с опечатками). */
export function speciesMatches(s: Species, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [s.latinName, ...s.commonNamesRu, ...s.commonNamesEn, ...s.synonyms].some((n) =>
    n.toLowerCase().includes(q),
  );
}

/** Ранжирование как у search_species: точное название, затем начало, затем вхождение. */
export function searchLocal(all: Species[], query: string): Species[] {
  const q = query.trim().toLowerCase();
  if (!q) return all;
  const rank = (s: Species) => {
    const names = [s.latinName, ...s.synonyms, ...s.commonNamesRu, ...s.commonNamesEn].map((n) => n.toLowerCase());
    if (names.includes(q)) return 0;
    if (names.some((n) => n.startsWith(q))) return 1;
    return 2;
  };
  return all
    .filter((s) => speciesMatches(s, q))
    .sort((a, b) => rank(a) - rank(b) || a.latinName.localeCompare(b.latinName));
}

export const DIFFICULTY_LABELS = ["", "Неубиваемое", "Легко", "Средне", "Капризное", "Для экспертов"];

/** Подборки на витрине базы знаний. */
export const COLLECTIONS: { id: string; title: string; subtitle: string; test: (s: Species) => boolean }[] = [
  { id: "pet-safe", title: "Безопасно для кошек", subtitle: "Не ядовиты для питомцев", test: (s) => s.toxicToPets === false },
  { id: "shade", title: "Для тёмной квартиры", subtitle: "Мирятся с тенью и полутенью", test: (s) => s.care?.light === "low" || s.care?.light === "medium" },
  { id: "easy", title: "Неубиваемые", subtitle: "Простят забывчивость", test: (s) => (s.difficulty ?? 5) <= 1 },
  { id: "air", title: "Очищают воздух", subtitle: "Лучшие для спальни и офиса", test: (s) => s.airPurifying === true },
  { id: "succulents", title: "Суккуленты и кактусы", subtitle: "Полив раз в пару недель", test: (s) => s.plantType === "суккулент" },
];
