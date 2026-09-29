/**
 * Группы базы знаний («Ароидные», «Кактусы и суккуленты»…): список и правила — в
 * src/data/species-groups.json, их же читает scripts/sync-species.mjs при сборке указателя.
 */

import data from "../../data/species-groups.json";

export interface SpeciesGroup {
  id: string;
  title: string;
  subtitle: string;
  /** Вид для обложки плитки группы. */
  cover: string;
}

interface Rule {
  group: string;
  fertilizer?: string[];
  plantType?: string[];
  genus?: string[];
}

/** Группы в порядке показа на витрине. */
export const SPECIES_GROUPS: SpeciesGroup[] = data.groups;

const byId = new Map(SPECIES_GROUPS.map((g) => [g.id, g]));
export const speciesGroup = (id: string | null | undefined) => (id ? (byId.get(id) ?? null) : null);

/** Первое подходящее правило: по программе подкормки, типу растения или роду. Последнее правило — «все остальные». */
export function speciesGroupId(s: { latinName: string; plantType: string | null; fertilizerSlug: string | null }): string {
  const genus = s.latinName.replace(/^×\s*/, "").split(" ")[0];
  for (const r of data.rules as Rule[]) {
    const fallback = !r.fertilizer && !r.plantType && !r.genus;
    if (
      fallback ||
      (s.fertilizerSlug && r.fertilizer?.includes(s.fertilizerSlug)) ||
      (s.plantType && r.plantType?.includes(s.plantType)) ||
      r.genus?.includes(genus)
    )
      return r.group;
  }
  return "foliage";
}
