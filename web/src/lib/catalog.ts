/**
 * Лёгкий указатель базы знаний для браузера: названия, фото, сложность, группа —
 * без ухода и описаний (≈в 4 раза меньше полного снимка). Полные данные вида — в lib/knowledge.ts:
 * на сервере при сборке страниц, а в браузере — только по требованию (plant-card/species-notes).
 */

import rows from "@/data/species-index.json";
import { SPECIES_GROUPS, type SpeciesGroup } from "./domain/groups";
import { searchFuzzy, speciesName, summaryFromIndexRow, type SpeciesIndexRow, type SpeciesSummary } from "./domain/species";

export const CATALOG: SpeciesSummary[] = (rows as SpeciesIndexRow[]).map(summaryFromIndexRow);

/** Группы витрины с видами по алфавиту (русские названия); пустые группы не показываем. */
export const CATALOG_GROUPS: { group: SpeciesGroup; species: SpeciesSummary[] }[] = SPECIES_GROUPS.map((group) => ({
  group,
  species: CATALOG.filter((s) => s.group === group.id).sort((a, b) => speciesName(a).localeCompare(speciesName(b), "ru")),
})).filter((g) => g.species.length > 0);

const bySlug = new Map(CATALOG.map((s) => [s.slug, s]));
/** Вид по slug (адрес страницы вида); null — нет такого. */
export const catalogBySlug = (slug: string | null | undefined) => (slug ? (bySlug.get(slug) ?? null) : null);
const byId = new Map(CATALOG.map((s) => [s.id, s]));
/** Вид по id из базы знаний. */
export const catalogById = (id: string | null | undefined) => (id ? (byId.get(id) ?? null) : null);

/** Поиск с учётом опечаток по всему указателю. */
export const searchCatalog = (query: string, all: SpeciesSummary[] = CATALOG) => searchFuzzy(all, query);

/** Своё фото растения, а если его нет — фото вида из базы знаний. */
export const plantPhotoUrl = (p: { photoUrl: string | null; speciesSlug: string | null } | null | undefined) =>
  p ? (p.photoUrl ?? catalogBySlug(p.speciesSlug)?.image?.url ?? null) : null;
