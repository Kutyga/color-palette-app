/**
 * Сад в браузере: повторяет серверные триггеры — пересчёт графика, подстройку
 * интервала по фактическим поливам и статистику для достижений.
 */
import {
  CARE_TYPE_ORDER,
  adjustUserFactor,
  effectiveIntervalDays,
  nextDue,
  type CareSchedule,
  type CareTask,
  type CareType,
  type LightLevel,
} from "../../domain/care";
import { EMPTY_STATS, type GardenStats } from "../../domain/gamification";
import type { Plant } from "../../domain/plant";
import { speciesName, type Species } from "../../domain/species";
import { blobToDataUrl } from "../../image";
import { ALL_SPECIES } from "../../knowledge";
import { DAY_MS, HOUR_MS, startOfDay } from "../../time";
import type { GardenRepository, PlantDraft } from "../repositories";
import { initialSchedules } from "../schedules";
import { type DemoState, type PlantRec, type ScheduleRec, iso, toDate } from "./state";

export class DemoGarden implements GardenRepository {
  constructor(
    private state: DemoState,
    private persist: () => void,
    private clock: () => Date = () => new Date(),
    private species: Species[] = ALL_SPECIES,
  ) {}

  private speciesOf(p: PlantRec) {
    return this.species.find((s) => s.slug === p.speciesSlug) ?? null;
  }

  private toPlant(p: PlantRec): Plant {
    const loc = this.state.locations.find((l) => l.id === p.locationId);
    const water = this.state.schedules.find((s) => s.plantId === p.id && s.type === "water");
    const sp = this.speciesOf(p);
    return {
      id: p.id,
      nickname: p.nickname,
      speciesId: sp?.id ?? null,
      speciesName: sp ? speciesName(sp) : null,
      speciesSlug: sp?.slug ?? null,
      locationId: p.locationId,
      locationName: loc?.name ?? null,
      lightLevel: loc?.lightLevel ?? null,
      potMaterial: p.potMaterial,
      visibility: p.visibility,
      notes: p.notes,
      inWater: !!p.inWater,
      nextWaterAt: p.inWater ? null : toDate(water?.nextDueAt ?? null),
      photoUrl: this.state.photos[p.id] ?? null,
      createdAt: new Date(p.createdAt),
    };
  }

  private schedule(s: ScheduleRec): CareSchedule {
    return { ...s, lastDoneAt: toDate(s.lastDoneAt), nextDueAt: toDate(s.nextDueAt) };
  }

  async myPlants() {
    return this.state.plants.map((p) => this.toPlant(p));
  }

  async plantDetails(plantId: string) {
    const p = this.state.plants.find((x) => x.id === plantId);
    if (!p) throw new Error("Растение не найдено");
    return {
      plant: this.toPlant(p),
      schedules: this.state.schedules
        .filter((s) => s.plantId === plantId)
        .map((s) => this.schedule(s))
        .sort((a, b) => CARE_TYPE_ORDER.indexOf(a.type) - CARE_TYPE_ORDER.indexOf(b.type)),
      events: this.state.events
        .filter((e) => e.plantId === plantId)
        .map((e) => ({ ...e, performedAt: new Date(e.performedAt) }))
        .sort((a, b) => b.performedAt.getTime() - a.performedAt.getTime()),
    };
  }

  async addPlant(draft: PlantDraft) {
    const id = crypto.randomUUID();
    const rec: PlantRec = {
      id,
      nickname: draft.nickname,
      speciesSlug: draft.speciesSlug ?? null,
      locationId: draft.locationId ?? null,
      potMaterial: draft.potMaterial ?? null,
      visibility: draft.visibility ?? "followers",
      notes: draft.notes ?? null,
      createdAt: this.clock().toISOString(),
      inWater: !!draft.inWater,
    };
    this.state.plants.push(rec);
    for (const seed of initialSchedules(this.speciesOf(rec)?.care ?? null, draft)) {
      const s: ScheduleRec = {
        id: crypto.randomUUID(),
        plantId: id,
        type: seed.type,
        intervalDays: seed.intervalDays,
        autoAdjust: true,
        userFactor: 1,
        lastDoneAt: iso(seed.lastDoneAt),
        nextDueAt: null,
        // Как триггер в базе: растению в воде полив не нужен.
        enabled: !(seed.type === "water" && rec.inWater),
      };
      this.state.schedules.push(this.computeDue(s));
    }
    this.persist();
    return this.toPlant(rec);
  }

  async setLocation(plantId: string, locationId: string | null) {
    const p = this.state.plants.find((x) => x.id === plantId);
    if (!p) throw new Error("Растение не найдено");
    p.locationId = locationId;
    // Свет на новом месте другой — пересчитываем сроки, как триггер в базе.
    this.state.schedules = this.state.schedules.map((s) => (s.plantId === plantId ? this.computeDue(s) : s));
    this.persist();
  }

  async deleteCareEvent(eventId: string) {
    const e = this.state.events.find((x) => x.id === eventId);
    if (!e) return;
    this.state.events = this.state.events.filter((x) => x.id !== eventId);
    const i = this.state.schedules.findIndex((s) => s.plantId === e.plantId && s.type === e.type);
    if (i >= 0 && this.state.schedules[i].lastDoneAt === e.performedAt) {
      const s = this.state.schedules[i];
      this.state.schedules[i] = this.computeDue({ ...s, lastDoneAt: e.prevDoneAt ?? null, userFactor: e.prevFactor ?? s.userFactor });
    }
    this.persist();
  }

  async setInWater(plantId: string, inWater: boolean) {
    const p = this.state.plants.find((x) => x.id === plantId);
    if (!p) throw new Error("Растение не найдено");
    p.inWater = inWater;
    for (const sch of this.state.schedules) if (sch.plantId === plantId && sch.type === "water") sch.enabled = !inWater;
    this.persist();
  }

  async deletePlant(plantId: string) {
    this.state.plants = this.state.plants.filter((p) => p.id !== plantId);
    this.state.schedules = this.state.schedules.filter((s) => s.plantId !== plantId);
    this.state.events = this.state.events.filter((e) => e.plantId !== plantId);
    delete this.state.photos[plantId];
    this.persist();
  }

  async setPlantPhoto(plantId: string, jpeg: Blob) {
    this.state.photos[plantId] = await blobToDataUrl(jpeg);
    this.persist();
  }

  async myLocations() {
    return [...this.state.locations];
  }

  async addLocation(name: string, lightLevel: LightLevel | null) {
    const loc = { id: crypto.randomUUID(), name, lightLevel };
    this.state.locations.push(loc);
    this.persist();
    return loc;
  }

  async updateLocation(id: string, name: string, lightLevel: LightLevel | null) {
    const loc = this.state.locations.find((l) => l.id === id);
    if (!loc) throw new Error("Место не найдено");
    loc.name = name.trim();
    loc.lightLevel = lightLevel;
    this.recomputeAt(id);
    this.persist();
    return { ...loc };
  }

  async deleteLocation(id: string) {
    this.state.locations = this.state.locations.filter((l) => l.id !== id);
    const moved = this.state.plants.filter((p) => p.locationId === id);
    for (const p of moved) p.locationId = null;
    this.state.schedules = this.state.schedules.map((s) => (moved.some((p) => p.id === s.plantId) ? this.computeDue(s) : s));
    this.persist();
  }

  /** Аналог триггера locations_recompute_schedules: свет места влияет на сроки его растений. */
  private recomputeAt(locationId: string) {
    const here = new Set(this.state.plants.filter((p) => p.locationId === locationId).map((p) => p.id));
    this.state.schedules = this.state.schedules.map((s) => (here.has(s.plantId) ? this.computeDue(s) : s));
  }

  async dueTasks(until: Date): Promise<CareTask[]> {
    return this.state.schedules
      .filter((s) => s.enabled && s.nextDueAt && new Date(s.nextDueAt) <= until)
      .flatMap((s) => {
        const plant = this.state.plants.find((p) => p.id === s.plantId);
        return plant
          ? [{ scheduleId: s.id, plantId: s.plantId, plantName: plant.nickname, type: s.type, dueAt: new Date(s.nextDueAt!) }]
          : [];
      })
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  }

  /** Аналог триггера care_events_apply. */
  async logCare(plantId: string, type: CareType, opts: { id?: string; performedAt?: Date; note?: string } = {}) {
    if (opts.id && this.state.events.some((e) => e.id === opts.id)) return;
    const at = opts.performedAt ?? this.clock();
    const i = this.state.schedules.findIndex((s) => s.plantId === plantId && s.type === type);
    const prev = i >= 0 ? this.state.schedules[i] : null;
    this.state.events.push({
      id: opts.id ?? crypto.randomUUID(),
      plantId,
      type,
      performedAt: at.toISOString(),
      note: opts.note ?? null,
      prevDoneAt: prev?.lastDoneAt ?? null,
      prevFactor: prev?.userFactor,
    });

    if (i >= 0) {
      const s = this.state.schedules[i];
      const last = toDate(s.lastDoneAt);
      if (!last || at > last) {
        let factor = s.userFactor;
        if (s.autoAdjust && last) {
          factor = adjustUserFactor(factor, this.intervalAt(s, last), (at.getTime() - last.getTime()) / DAY_MS);
        }
        this.state.schedules[i] = this.computeDue({ ...s, userFactor: factor, lastDoneAt: at.toISOString() });
      }
    }
    this.persist();
  }

  async careEventsSince(since: Date) {
    return this.state.events.map((e) => ({ ...e, performedAt: new Date(e.performedAt) })).filter((e) => e.performedAt >= since);
  }

  /** Аналог RPC my_garden_stats. */
  async stats(): Promise<GardenStats> {
    const events = this.state.events.map((e) => ({ ...e, at: new Date(e.performedAt) }));
    const plantSpecies = this.state.plants.map((p) => this.speciesOf(p)).filter((s): s is Species => !!s);
    const count = (t: CareType) => events.filter((e) => e.type === t).length;
    const dayKey = (d: Date) => startOfDay(d).getTime();
    const days = [...new Set(events.map((e) => dayKey(e.at)))].sort((a, b) => a - b);
    let best = 0;
    let run = 0;
    let prev: number | null = null;
    for (const d of days) {
      run = prev !== null && Math.round((d - prev) / HOUR_MS) === 24 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = d;
    }
    const alive = prev !== null && Math.round((dayKey(this.clock()) - prev) / HOUR_MS) <= 24;
    return {
      ...EMPTY_STATS,
      plants: this.state.plants.length,
      species: new Set(this.state.plants.map((p) => p.speciesSlug).filter(Boolean)).size,
      locations: this.state.locations.length,
      petSafe: plantSpecies.filter((s) => s.toxicToPets === false).length,
      succulents: plantSpecies.filter((s) => s.plantType === "суккулент").length,
      careEvents: events.length,
      waterings: count("water"),
      fertilizings: count("fertilize"),
      mistings: count("mist"),
      repots: count("repot"),
      earlyBird: events.filter((e) => e.at.getHours() >= 5 && e.at.getHours() < 8).length,
      nightOwl: events.filter((e) => e.at.getHours() >= 23 || e.at.getHours() < 4).length,
      currentStreak: alive ? run : 0,
      bestStreak: best,
      inWater: this.state.plants.filter((p) => p.inWater).length,
    };
  }

  /** Аналог триггера care_schedules_compute_due. */
  private computeDue(s: ScheduleRec): ScheduleRec {
    const base = toDate(s.lastDoneAt) ?? this.clock();
    return { ...s, nextDueAt: nextDue(base, this.intervalAt(s, base)).toISOString() };
  }

  private intervalAt(s: ScheduleRec, at: Date) {
    const plant = this.state.plants.find((p) => p.id === s.plantId);
    return effectiveIntervalDays({
      type: s.type,
      intervalDays: s.intervalDays,
      userFactor: s.userFactor,
      autoAdjust: s.autoAdjust,
      month: at.getMonth() + 1,
      pot: plant?.potMaterial,
      light: this.state.locations.find((l) => l.id === plant?.locationId)?.lightLevel,
    });
  }
}
