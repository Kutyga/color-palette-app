import type { CareEvent, CareSchedule, LightLevel, PotMaterial } from "./care";

export const VISIBILITIES = {
  private: "Только я",
  followers: "Подписчики",
  public: "Все",
} as const;
export type Visibility = keyof typeof VISIBILITIES;

export interface Location {
  id: string;
  name: string;
  lightLevel: LightLevel | null;
}

export interface Plant {
  id: string;
  nickname: string;
  speciesId: string | null;
  speciesName: string | null;
  speciesSlug: string | null;
  locationId: string | null;
  locationName: string | null;
  lightLevel: LightLevel | null;
  potMaterial: PotMaterial | null;
  visibility: Visibility;
  notes: string | null;
  /** Денормализовано из графика полива — для статуса в списке коллекции. */
  nextWaterAt: Date | null;
  /** Обложка: подписанная ссылка из Storage или data URL (демо-режим). */
  photoUrl: string | null;
  createdAt: Date;
}

export interface PlantDetails {
  plant: Plant;
  schedules: CareSchedule[];
  events: CareEvent[];
}

/** Черновик нового растения с формы добавления. */
export interface NewPlant {
  nickname: string;
  speciesId?: string | null;
  locationId?: string | null;
  potMaterial?: PotMaterial | null;
  visibility?: Visibility;
  /** Если не задан — из базы знаний по виду, иначе 7 дней. */
  waterIntervalDays?: number | null;
  lastWateredAt?: Date | null;
  notes?: string | null;
}

type Row = Record<string, unknown>;

/**
 * Ожидает выборку `*, species(slug, latin_name, common_names), locations(name, light_level),
 * care_schedules(type, next_due_at), cover:plant_photos!plants_cover_photo_fk(storage_path)`.
 */
export function plantFromRow(r: Row, photoUrl: string | null = null): Plant {
  const species = r.species as { slug?: string; latin_name: string; common_names?: { ru?: string[] } } | null;
  const location = r.locations as { name: string; light_level: LightLevel | null } | null;
  const schedules = (r.care_schedules as { type: string; next_due_at: string | null }[] | null) ?? [];
  const water = schedules.find((s) => s.type === "water" && s.next_due_at);
  return {
    id: r.id as string,
    nickname: r.nickname as string,
    speciesId: (r.species_id as string | null) ?? null,
    speciesName: species ? (species.common_names?.ru?.[0] ?? species.latin_name) : null,
    speciesSlug: species?.slug ?? null,
    locationId: (r.location_id as string | null) ?? null,
    locationName: location?.name ?? null,
    lightLevel: location?.light_level ?? null,
    potMaterial: (r.pot_material as PotMaterial | null) ?? null,
    visibility: ((r.visibility as Visibility | null) ?? "followers"),
    notes: (r.notes as string | null) ?? null,
    nextWaterAt: water?.next_due_at ? new Date(water.next_due_at) : null,
    photoUrl,
    createdAt: new Date((r.created_at as string | undefined) ?? Date.now()),
  };
}

export const coverPathOf = (r: Row) => ((r.cover as { storage_path?: string } | null)?.storage_path ?? null);

export type PlantStatus = "ok" | "soon" | "overdue";

/** Статус для точки в углу карточки: просрочено / полив сегодня-завтра / всё хорошо. */
export function plantStatus(p: Pick<Plant, "nextWaterAt">, now: Date): PlantStatus {
  if (!p.nextWaterAt) return "ok";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (p.nextWaterAt < today) return "overdue";
  if (p.nextWaterAt.getTime() < today.getTime() + 2 * 86_400_000) return "soon";
  return "ok";
}
