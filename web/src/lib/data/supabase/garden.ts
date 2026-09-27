/**
 * Сад в Supabase: растения, места, график ухода, отметки и статистика.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { eventFromRow, scheduleFromRow, taskFromRow, type CareType } from "../../domain/care";
import { statsFromRow } from "../../domain/gamification";
import { coverPathOf, plantFromRow, type Location } from "../../domain/plant";
import { careFromRow } from "../../domain/species";
import { initialSchedules } from "../schedules";
import type { GardenRepository, PlantDraft } from "../repositories";

import { PLANT_BUCKET, PLANT_SELECT, type Row, check, signedUrls } from "./shared";

export class SupabaseGarden implements GardenRepository {
  constructor(
    private db: SupabaseClient,
    private uid: string,
  ) {}

  private async withPhotos(rows: Row[]) {
    const urls = await signedUrls(
      this.db,
      PLANT_BUCKET,
      rows.map(coverPathOf).filter((p): p is string => !!p),
    );
    return rows.map((r) => plantFromRow(r, urls.get(coverPathOf(r) ?? "") ?? null));
  }

  async myPlants() {
    const rows = check(
      await this.db.from("plants").select(PLANT_SELECT).eq("owner_id", this.uid).is("deleted_at", null).order("created_at"),
    );
    return this.withPhotos(rows as Row[]);
  }

  async plantDetails(plantId: string) {
    const [plant, schedules, events] = await Promise.all([
      this.db.from("plants").select(PLANT_SELECT).eq("id", plantId).single(),
      this.db.from("care_schedules").select().eq("plant_id", plantId).order("type"),
      this.db.from("care_events").select().eq("plant_id", plantId).order("performed_at", { ascending: false }).limit(50),
    ]);
    return {
      plant: (await this.withPhotos([check(plant) as Row]))[0],
      schedules: (check(schedules) as Row[]).map(scheduleFromRow),
      events: (check(events) as Row[]).map(eventFromRow),
    };
  }

  async addPlant(draft: PlantDraft) {
    let speciesId: string | null = null;
    let care = null;
    if (draft.speciesSlug) {
      const sp = check(
        await this.db.from("species").select("id, care_profiles(*)").eq("slug", draft.speciesSlug).maybeSingle(),
      ) as Row | null;
      if (sp) {
        speciesId = sp.id as string;
        const raw = Array.isArray(sp.care_profiles) ? sp.care_profiles[0] : sp.care_profiles;
        care = raw ? careFromRow(raw as Row) : null;
      }
    }
    const id = crypto.randomUUID();
    check(
      await this.db.from("plants").insert({
        id,
        nickname: draft.nickname,
        species_id: speciesId,
        location_id: draft.locationId ?? null,
        pot_material: draft.potMaterial ?? null,
        visibility: draft.visibility ?? "followers",
        notes: draft.notes ?? null,
        in_water: draft.inWater ?? false,
      }),
    );
    const seeds = initialSchedules(care, draft);
    check(
      await this.db.from("care_schedules").insert(
        seeds.map((s) => ({
          id: crypto.randomUUID(),
          plant_id: id,
          type: s.type,
          interval_days: s.intervalDays,
          last_done_at: s.lastDoneAt?.toISOString() ?? null,
        })),
      ),
    );
    return (await this.plantDetails(id)).plant;
  }

  async setLocation(plantId: string, locationId: string | null) {
    check(await this.db.from("plants").update({ location_id: locationId }).eq("id", plantId));
  }

  async deleteCareEvent(eventId: string) {
    const { data, error } = await this.db.from("care_events").delete().eq("id", eventId).select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error("Эту отметку удалить нельзя — её сделал другой человек");
  }

  async setInWater(plantId: string, inWater: boolean) {
    check(await this.db.from("plants").update({ in_water: inWater }).eq("id", plantId));
  }

  async deletePlant(plantId: string) {
    check(await this.db.from("plants").update({ deleted_at: new Date().toISOString() }).eq("id", plantId));
  }

  async setPlantPhoto(plantId: string, jpeg: Blob) {
    const photoId = crypto.randomUUID();
    const path = `${this.uid}/${plantId}/${photoId}.jpg`;
    check(await this.db.storage.from(PLANT_BUCKET).upload(path, jpeg, { contentType: "image/jpeg" }));
    check(await this.db.from("plant_photos").insert({ id: photoId, plant_id: plantId, storage_path: path }));
    check(await this.db.from("plants").update({ cover_photo_id: photoId }).eq("id", plantId));
  }

  async myLocations(): Promise<Location[]> {
    const rows = check(await this.db.from("locations").select().eq("owner_id", this.uid).is("deleted_at", null).order("name")) as Row[];
    return rows.map((r) => ({ id: r.id as string, name: r.name as string, lightLevel: (r.light_level as never) ?? null }));
  }

  async addLocation(name: string, light: Location["lightLevel"]) {
    const r = check(await this.db.from("locations").insert({ id: crypto.randomUUID(), name, light_level: light }).select().single()) as Row;
    return { id: r.id as string, name: r.name as string, lightLevel: (r.light_level as never) ?? null };
  }

  async updateLocation(id: string, name: string, light: Location["lightLevel"]) {
    const r = check(
      await this.db
        .from("locations")
        .update({ name: name.trim(), light_level: light })
        .eq("id", id)
        .eq("owner_id", this.uid)
        .select()
        .single(),
    ) as Row;
    return { id: r.id as string, name: r.name as string, lightLevel: (r.light_level as never) ?? null };
  }

  /** Растения этого места база оставляет без места (on delete set null) и пересчитывает сроки. */
  async deleteLocation(id: string) {
    check(await this.db.from("locations").delete().eq("id", id).eq("owner_id", this.uid));
  }

  async dueTasks(until: Date) {
    const rows = check(await this.db.rpc("care_due", { p_until: until.toISOString() })) as Row[];
    return rows.map(taskFromRow);
  }

  async logCare(plantId: string, type: CareType, opts: { id?: string; performedAt?: Date; note?: string } = {}) {
    const { error } = await this.db.from("care_events").insert({
      id: opts.id ?? crypto.randomUUID(),
      plant_id: plantId,
      type,
      performed_at: (opts.performedAt ?? new Date()).toISOString(),
      note: opts.note ?? null,
    });
    // Запись уже дошла при прошлой попытке (ответ потерялся) — считаем успехом.
    if (error && error.code !== "23505") throw new Error(error.message);
  }

  async careEventsSince(since: Date) {
    const rows = check(
      await this.db
        .from("care_events")
        .select("*, plants!inner(owner_id)")
        .eq("plants.owner_id", this.uid)
        .gte("performed_at", since.toISOString()),
    ) as Row[];
    return rows.map(eventFromRow);
  }

  async stats() {
    const [row, inWater] = await Promise.all([
      this.db.rpc("my_garden_stats"),
      this.db
        .from("plants")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", this.uid)
        .eq("in_water", true)
        .is("deleted_at", null),
    ]);
    return { ...statsFromRow(check(row) as Row), inWater: inWater.count ?? 0 };
  }
}
