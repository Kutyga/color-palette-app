/**
 * Полная база знаний в сборке: виды с уходом, грунтовые смеси и подкормки из JSON-снимка и связи
 * между ними. Нужна страницам видов на сервере и демо-режиму; обычным страницам в браузере хватает
 * лёгкого указателя lib/catalog.ts.
 */

import fertRows from "@/data/fertilizers.json";
import soilRows from "@/data/soil-mixes.json";
import rows from "@/data/species.json";
import { fertilizerFromRow, type Fertilizer } from "./domain/fertilizer";
import { soilMixFromRow, type SoilMix } from "./domain/soil";
import { speciesFromRow, type Species } from "./domain/species";

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
