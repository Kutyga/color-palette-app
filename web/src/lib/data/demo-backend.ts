import {
  adjustUserFactor,
  effectiveIntervalDays,
  nextDue,
  CARE_TYPE_ORDER,
  type CareEvent,
  type CareSchedule,
  type CareTask,
  type CareType,
  type LightLevel,
  type PotMaterial,
} from "../domain/care";
import type { GardenStats } from "../domain/gamification";
import type { Location, Plant, Visibility } from "../domain/plant";
import type { FeedPost, FeedTab, NewPost, NewsArticle, PostComment } from "../domain/social";
import { speciesName, type Species } from "../domain/species";
import { blobToDataUrl } from "../image";
import { ALL_SPECIES } from "../knowledge";
import { initialSchedules } from "./schedules";
import type { Backend, GardenRepository, PlantDraft, SocialRepository } from "./types";

interface PlantRec {
  id: string;
  nickname: string;
  speciesSlug: string | null;
  locationId: string | null;
  potMaterial: PotMaterial | null;
  visibility: Visibility;
  notes: string | null;
  createdAt: string;
}
type Dated<T, K extends keyof T> = Omit<T, K> & { [P in K]: string | null };
type ScheduleRec = Dated<CareSchedule, "lastDoneAt" | "nextDueAt">;
type EventRec = Omit<CareEvent, "performedAt"> & { performedAt: string };
type PostRec = Omit<FeedPost, "createdAt" | "mine" | "following"> & { createdAt: string };
type CommentRec = Omit<PostComment, "createdAt"> & { createdAt: string };

export interface DemoState {
  version: 1;
  plants: PlantRec[];
  locations: Location[];
  schedules: ScheduleRec[];
  events: EventRec[];
  /** Фото растений — data URL, пока пользователь не зарегистрировался. */
  photos: Record<string, string>;
  posts: PostRec[];
  comments: CommentRec[];
  /** id авторов, на которых подписан пользователь. */
  following: string[];
}

const ME = "me";
const iso = (d: Date | null) => (d ? d.toISOString() : null);
const toDate = (s: string | null) => (s ? new Date(s) : null);

/** Где хранить состояние: localStorage в браузере, память — в тестах. */
export interface DemoStorage {
  load(): DemoState | null;
  save(state: DemoState): void;
}

export const localDemoStorage = (key = "moi-sad-demo"): DemoStorage => ({
  load() {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as DemoState) : null;
    } catch {
      return null;
    }
  },
  save(state) {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Переполнение хранилища (много фото) — данные останутся до перезагрузки страницы.
    }
  },
});

export const memoryDemoStorage = (): DemoStorage => {
  let saved: DemoState | null = null;
  return { load: () => saved, save: (s) => void (saved = structuredClone(s)) };
};

const emptyState = (): DemoState => ({
  version: 1, plants: [], locations: [], schedules: [], events: [], photos: {}, posts: [], comments: [],
  following: ["demo-anna.green", "demo-orchid.mood"],
});

/**
 * Демо-режим: всё хранится в браузере и повторяет серверные триггеры (пересчёт графика,
 * подстройку коэффициента, статистику). Используется без регистрации и в тестах.
 */
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
      nextWaterAt: toDate(water?.nextDueAt ?? null),
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
        enabled: true,
      };
      this.state.schedules.push(this.computeDue(s));
    }
    this.persist();
    return this.toPlant(rec);
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
    this.state.events.push({ id: opts.id ?? crypto.randomUUID(), plantId, type, performedAt: at.toISOString(), note: opts.note ?? null });

    const i = this.state.schedules.findIndex((s) => s.plantId === plantId && s.type === type);
    if (i >= 0) {
      const s = this.state.schedules[i];
      const last = toDate(s.lastDoneAt);
      if (!last || at > last) {
        let factor = s.userFactor;
        if (s.autoAdjust && last) {
          factor = adjustUserFactor(factor, this.intervalAt(s, last), (at.getTime() - last.getTime()) / 86_400_000);
        }
        this.state.schedules[i] = this.computeDue({ ...s, userFactor: factor, lastDoneAt: at.toISOString() });
      }
    }
    this.persist();
  }

  async careEventsSince(since: Date) {
    return this.state.events
      .map((e) => ({ ...e, performedAt: new Date(e.performedAt) }))
      .filter((e) => e.performedAt >= since);
  }

  /** Аналог RPC my_garden_stats. */
  async stats(): Promise<GardenStats> {
    const events = this.state.events.map((e) => ({ ...e, at: new Date(e.performedAt) }));
    const plantSpecies = this.state.plants.map((p) => this.speciesOf(p)).filter((s): s is Species => !!s);
    const count = (t: CareType) => events.filter((e) => e.type === t).length;
    const dayKey = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = [...new Set(events.map((e) => dayKey(e.at)))].sort((a, b) => a - b);
    let best = 0;
    let run = 0;
    let prev: number | null = null;
    for (const d of days) {
      run = prev !== null && Math.round((d - prev) / 3_600_000) === 24 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = d;
    }
    const alive = prev !== null && Math.round((dayKey(this.clock()) - prev) / 3_600_000) <= 24;
    return {
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
      posts: 0,
      likesReceived: 0,
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

const SAMPLE_POSTS: [string, string, string, number][] = [
  ["anna.green", "Монстера Бублик", "Седьмой резной лист за лето 🌿 Секрет — опора из кокоса и терпение.", 1284],
  ["fikus_papa", "Роберт", "Год назад был черенком в стакане. Теперь выше кота.", 932],
  ["succulove", "Денежка", "Зимую на прохладном подоконнике, поливаю раз в месяц — и никаких проблем.", 457],
  ["orchid.mood", "Луна", "Третье цветение подряд! Полив погружением раз в неделю.", 2110],
];

export class DemoSocial implements SocialRepository {
  constructor(
    private state: DemoState,
    private persist: () => void,
    private clock: () => Date = () => new Date(),
  ) {}

  private post(p: PostRec): FeedPost {
    return {
      ...p,
      createdAt: new Date(p.createdAt),
      mine: p.authorId === ME,
      following: (this.state.following ?? []).includes(p.authorId),
    };
  }

  async feed(tab: FeedTab) {
    return this.state.posts
      .filter((p) => tab === "discover" || p.authorId === ME || (this.state.following ?? []).includes(p.authorId))
      .map((p) => this.post(p))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createPost(post: NewPost) {
    const plant = this.state.plants.find((p) => p.id === post.plantId);
    const rec: PostRec = {
      id: crypto.randomUUID(),
      authorId: ME,
      authorName: "вы",
      text: post.text,
      createdAt: this.clock().toISOString(),
      plantId: post.plantId ?? null,
      plantName: plant?.nickname ?? null,
      photoUrl: post.photo ? await blobToDataUrl(post.photo) : null,
      likeCount: 0,
      commentCount: 0,
      likedByMe: false,
    };
    this.state.posts.push(rec);
    this.persist();
    return this.post(rec);
  }

  async setLiked(postId: string, liked: boolean) {
    const p = this.state.posts.find((x) => x.id === postId);
    if (!p || p.likedByMe === liked) return;
    p.likedByMe = liked;
    p.likeCount += liked ? 1 : -1;
    this.persist();
  }

  async setFollowing(authorId: string, follow: boolean) {
    const rest = (this.state.following ?? []).filter((id) => id !== authorId);
    this.state.following = follow ? [...rest, authorId] : rest;
    this.persist();
  }

  async comments(postId: string) {
    return this.state.comments
      .filter((c) => c.postId === postId)
      .map((c) => ({ ...c, createdAt: new Date(c.createdAt) }))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async addComment(postId: string, text: string) {
    const c: CommentRec = { id: crypto.randomUUID(), postId, authorName: "вы", text, createdAt: this.clock().toISOString(), mine: true };
    this.state.comments.push(c);
    this.bump(postId, 1);
    this.persist();
    return { ...c, createdAt: new Date(c.createdAt) };
  }

  async deleteComment(commentId: string) {
    const c = this.state.comments.find((x) => x.id === commentId);
    if (!c) return;
    this.state.comments = this.state.comments.filter((x) => x.id !== commentId);
    this.bump(c.postId, -1);
    this.persist();
  }

  private bump(postId: string, delta: number) {
    const p = this.state.posts.find((x) => x.id === postId);
    if (p) p.commentCount += delta;
  }

  async myActivity() {
    const mine = this.state.posts.filter((p) => p.authorId === ME);
    return { posts: mine.length, likesReceived: mine.reduce((sum, p) => sum + p.likeCount, 0) };
  }

  /** В демо-режиме — подборка советов из базы знаний вместо настоящих новостей. */
  async readArticle(): Promise<null> {
    return null;
  }

  async news(...[, langs = []]: [boolean?, string[]?]): Promise<NewsArticle[]> {
    if (langs.length && !langs.includes("ru")) return [];
    const now = this.clock().getTime();
    const picks = ["goeppertia-orbifolia", "schlumbergera-truncata", "ficus-lyrata", "dypsis-lutescens", "hoya-carnosa"];
    return picks
      .map((slug) => ALL_SPECIES.find((s) => s.slug === slug))
      .filter((s): s is Species => !!s)
      .map((s, i) => ({
        id: `demo-news-${s.slug}`,
        url: `/plants/${s.slug}/`,
        title: `${speciesName(s)}: ${s.care?.tipsRu[0] ?? "как ухаживать"}`,
        sourceName: "База знаний «Мой сад»",
        publishedAt: new Date(now - (i + 1) * 5 * 3_600_000),
        summary: s.descriptionRu,
        imageUrl: null,
        speciesIds: [s.id],
        language: "ru",
      }));
  }
}

/** Стартовые данные, чтобы экраны демо-режима не были пустыми. */
export async function seedDemo(state: DemoState, clock: () => Date = () => new Date()) {
  const garden = new DemoGarden(state, () => {}, clock);
  const now = clock();
  const ago = (days: number, hour = 10) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, hour);
  const room = await garden.addLocation("Гостиная", "bright_indirect");
  const kitchen = await garden.addLocation("Кухня", "medium");
  const bedroom = await garden.addLocation("Спальня", "medium");
  const mosya = await garden.addPlant({ nickname: "Монстера Мося", speciesSlug: "monstera-deliciosa", locationId: room.id, potMaterial: "plastic", lastWateredAt: ago(11) });
  const shchuchka = await garden.addPlant({ nickname: "Щучка", speciesSlug: "dracaena-trifasciata", locationId: kitchen.id, potMaterial: "ceramic" });
  const robert = await garden.addPlant({ nickname: "Фикус Роберт", speciesSlug: "ficus-elastica", locationId: room.id, potMaterial: "ceramic" });
  const osya = await garden.addPlant({ nickname: "Калатея Ося", speciesSlug: "goeppertia-orbifolia", locationId: bedroom.id, potMaterial: "plastic" });
  // Неделя ухода: серия дней и журнал в карточках.
  await garden.logCare(shchuchka.id, "water", { performedAt: ago(6) });
  await garden.logCare(robert.id, "water", { performedAt: ago(5) });
  await garden.logCare(osya.id, "water", { performedAt: ago(4, 9) });
  await garden.logCare(mosya.id, "fertilize", { performedAt: ago(3) });
  await garden.logCare(osya.id, "mist", { performedAt: ago(2, 7) });
  await garden.logCare(robert.id, "fertilize", { performedAt: ago(1, 19) });

  SAMPLE_POSTS.forEach(([author, plant, text, likes], i) =>
    state.posts.push({
      id: `demo-post-${i}`,
      authorId: `demo-${author}`,
      authorName: author,
      text,
      createdAt: new Date(now.getTime() - (3 + i * 7) * 3_600_000).toISOString(),
      plantId: null,
      plantName: plant,
      photoUrl: null,
      likeCount: likes,
      commentCount: 2,
      likedByMe: false,
    }),
  );
  state.posts.forEach((p) => {
    if (!p.id.startsWith("demo-post-")) return;
    state.comments.push(
      { id: `${p.id}-c1`, postId: p.id, authorName: "fikus_papa", text: "Какая красота! Чем подкармливаете?", createdAt: new Date(now.getTime() - 2 * 3_600_000).toISOString(), mine: false },
      { id: `${p.id}-c2`, postId: p.id, authorName: "succulove", text: "Сохранила себе в вишлист 🌿", createdAt: new Date(now.getTime() - 40 * 60_000).toISOString(), mine: false },
    );
  });
}

export async function demoBackend(storage: DemoStorage, clock: () => Date = () => new Date()): Promise<Backend> {
  let state = storage.load();
  if (!state || state.version !== 1) {
    state = emptyState();
    await seedDemo(state, clock);
    storage.save(state);
  }
  const s = state;
  const persist = () => storage.save(s);
  return {
    mode: "demo",
    garden: new DemoGarden(s, persist, clock),
    social: new DemoSocial(s, persist, clock),
    identifier: null,
    profile: async () => ({ username: "gost", displayName: "Гость" }),
  };
}
