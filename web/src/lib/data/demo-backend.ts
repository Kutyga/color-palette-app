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
import type { DiaryEvent, DiaryScope, FeedPost, HelpFilter, NewPost, NewsArticle, PostComment } from "../domain/social";
import { speciesName, type Species } from "../domain/species";
import { blobToDataUrl } from "../image";
import { ALL_SPECIES } from "../knowledge";
import { initialSchedules } from "./schedules";
import { validateProfile, type PersonCard, type ProfileUpdate, type PublicPlant } from "../domain/people";
import type { Backend, GardenRepository, PeopleRepository, PlantDraft, Profile, SocialRepository } from "./types";

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
// Поля дневника и вопросов необязательны: в сохранённых раньше демо-данных их нет.
type PostRec = Omit<FeedPost, "createdAt" | "mine" | "following" | "authorDisplayName" | "kind" | "event" | "speciesId" | "solvedCommentId"> &
  Partial<Pick<FeedPost, "kind" | "event" | "speciesId" | "solvedCommentId">> & { createdAt: string; authorDisplayName?: string };
type CommentRec = Omit<PostComment, "createdAt" | "authorDisplayName"> & { createdAt: string; authorDisplayName?: string };

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
  /** Свой профиль в демо-режиме (по умолчанию — «Гость»). */
  profile?: Profile;
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

/** Вымышленные садоводы демо-режима: их можно найти, открыть профиль и растения, подписаться. */
const DEMO_PEOPLE: { username: string; displayName: string; bio: string; followers: number; followsMe: boolean; plants: [string, string][] }[] = [
  {
    username: "anna.green",
    displayName: "Анна",
    bio: "Ароидные и калатеи. Подоконники на север — и всё растёт.",
    followers: 1840,
    followsMe: false,
    plants: [["Монстера Бублик", "monstera-deliciosa"], ["Калатея Ося", "goeppertia-orbifolia"], ["Сингониум", "syngonium-podophyllum"], ["Филодендрон Пинк", "philodendron-erubescens"]],
  },
  {
    username: "fikus_papa",
    displayName: "Фикус Папа",
    bio: "Фикусы всех мастей. Роберт — мой первый.",
    followers: 932,
    followsMe: true,
    plants: [["Роберт", "ficus-elastica"], ["Лира", "ficus-lyrata"], ["Бенджи", "ficus-benjamina"]],
  },
  {
    username: "succulove",
    displayName: "Света | суккуленты",
    bio: "Кактусы, литопсы и немного терпения.",
    followers: 457,
    followsMe: true,
    plants: [["Денежка", "crassula-ovata"], ["Камешки", "lithops-lesliei"], ["Алоэ", "aloe-vera"], ["Эхеверия", "echeveria-elegans"]],
  },
  {
    username: "orchid.mood",
    displayName: "Оля и орхидеи",
    bio: "Фаленопсисы цветут третий раз подряд.",
    followers: 2110,
    followsMe: false,
    plants: [["Луна", "phalaenopsis-hybrid"], ["Дендробиум", "dendrobium-nobile"]],
  },
];
const demoId = (username: string) => `demo-${username}`;
const DEFAULT_PROFILE: Profile = { username: "gost", displayName: "Гость", bio: null };

/** Записи дневников: автор, растение, вид, событие, текст, «поддержали». */
const SAMPLE_DIARIES: [string, string, string, DiaryEvent, string, number][] = [
  ["anna.green", "Монстера Бублик", "monstera-deliciosa", "new_leaf", "Седьмой резной лист за лето. Секрет — опора из кокоса и терпение.", 128],
  ["fikus_papa", "Роберт", "ficus-elastica", "progress", "Год назад был черенком в стакане. Теперь выше кота.", 93],
  ["succulove", "Денежка", "crassula-ovata", "repot", "Пересадила в терракоту на смесь для суккулентов с пемзой. Корни здоровые!", 45],
  ["orchid.mood", "Луна", "phalaenopsis-hybrid", "bloom", "Третье цветение подряд! Полив погружением раз в неделю.", 211],
];

/** Вопросы «Помощи»: автор, вид, текст, ответы [автор, текст], индекс лучшего ответа. */
const SAMPLE_QUESTIONS: [string, string, string, [string, string][], number | null][] = [
  [
    "fikus_papa",
    "monstera-deliciosa",
    "У монстеры желтеют нижние листья, новые растут нормально. Поливаю раз в неделю. Что не так?",
    [
      ["anna.green", "Проверьте землю пальцем на 3–4 см: если там сыро — это перелив. Поливайте только после просыхания."],
      ["orchid.mood", "Ещё бывает, что старые листья просто отмирают — если желтеет 1 лист в месяц, это нормально."],
    ],
    0,
  ],
  ["succulove", "goeppertia-orbifolia", "Калатея сворачивает листья днём. Стоит в метре от окна на восток. Это от света или от воздуха?", [], null],
  [
    "orchid.mood",
    "phalaenopsis-hybrid",
    "После пересадки у фаленопсиса сморщились листья. Сколько ждать, пока отойдёт?",
    [["succulove", "Обычно 2–3 недели. Поставьте в тень и опрыскивайте воздух рядом, а не листья."]],
    null,
  ],
];

export class DemoSocial implements SocialRepository {
  constructor(
    private state: DemoState,
    private persist: () => void,
    private clock: () => Date = () => new Date(),
  ) {}

  private toPost(p: PostRec): FeedPost {
    const me = this.state.profile ?? DEFAULT_PROFILE;
    const kind = p.kind ?? "diary";
    return {
      ...p,
      kind,
      event: kind === "diary" ? (p.event ?? "progress") : null,
      speciesId: p.speciesId ?? null,
      solvedCommentId: p.solvedCommentId ?? null,
      authorDisplayName:
        p.authorId === ME
          ? (me.displayName ?? "Вы")
          : (p.authorDisplayName ?? DEMO_PEOPLE.find((d) => demoId(d.username) === p.authorId)?.displayName ?? p.authorName),
      createdAt: new Date(p.createdAt),
      mine: p.authorId === ME,
      following: (this.state.following ?? []).includes(p.authorId),
    };
  }

  private get all() {
    return this.state.posts.map((p) => this.toPost(p)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async diaries(scope: DiaryScope) {
    const following = this.state.following ?? [];
    return this.all.filter((p) => p.kind === "diary" && (scope === "all" || p.mine || following.includes(p.authorId)));
  }

  async plantDiary(plantId: string) {
    return this.all.filter((p) => p.kind === "diary" && p.plantId === plantId).reverse();
  }

  async questions(filter: HelpFilter) {
    const mySpecies = new Set(this.state.plants.map((p) => ALL_SPECIES.find((s) => s.slug === p.speciesSlug)?.id).filter(Boolean));
    const list = this.all.filter(
      (p) =>
        p.kind === "question" &&
        (filter === "all" ||
          (filter === "open" && !p.solvedCommentId) ||
          (filter === "mine" && p.mine) ||
          (filter === "my_species" && p.speciesId != null && mySpecies.has(p.speciesId))),
    );
    // Без ответа — выше всех, как в базе.
    return filter === "open" ? [...list].sort((a, b) => Number(a.commentCount > 0) - Number(b.commentCount > 0)) : list;
  }

  async post(id: string) {
    const p = this.state.posts.find((x) => x.id === id);
    return p ? this.toPost(p) : null;
  }

  async markSolved(postId: string, commentId: string | null) {
    const p = this.state.posts.find((x) => x.id === postId);
    if (!p || p.authorId !== ME || p.kind !== "question") return;
    if (commentId && !this.state.comments.some((c) => c.id === commentId && c.postId === postId)) {
      throw new Error("Лучшим ответом можно отметить только ответ на этот вопрос");
    }
    p.solvedCommentId = commentId;
    this.persist();
  }

  async createPost(post: NewPost) {
    const plant = this.state.plants.find((p) => p.id === post.plantId);
    const rec: PostRec = {
      id: crypto.randomUUID(),
      kind: post.kind,
      event: post.kind === "diary" ? (post.event ?? "progress") : null,
      speciesId: ALL_SPECIES.find((s) => s.slug === plant?.speciesSlug)?.id ?? null,
      solvedCommentId: null,
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
    return this.toPost(rec);
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
      .map((c) => this.comment(c))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async addComment(postId: string, text: string) {
    const c: CommentRec = { id: crypto.randomUUID(), postId, authorName: (this.state.profile ?? DEFAULT_PROFILE).username, text, createdAt: this.clock().toISOString(), mine: true };
    this.state.comments.push(c);
    this.bump(postId, 1);
    this.persist();
    return this.comment(c);
  }

  private comment(c: CommentRec): PostComment {
    const me = this.state.profile ?? DEFAULT_PROFILE;
    const person = DEMO_PEOPLE.find((d) => d.username === c.authorName);
    return {
      ...c,
      authorDisplayName: c.mine ? (me.displayName ?? "Вы") : (c.authorDisplayName ?? person?.displayName ?? c.authorName),
      createdAt: new Date(c.createdAt),
    };
  }

  async deleteComment(commentId: string) {
    const c = this.state.comments.find((x) => x.id === commentId);
    if (!c) return;
    this.state.comments = this.state.comments.filter((x) => x.id !== commentId);
    const post = this.state.posts.find((x) => x.id === c.postId);
    if (post?.solvedCommentId === commentId) post.solvedCommentId = null;
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
        sourceName: "База знаний «Подоконника»",
        publishedAt: new Date(now - (i + 1) * 5 * 3_600_000),
        summary: s.descriptionRu,
        imageUrl: null,
        speciesIds: [s.id],
        language: "ru",
      }));
  }
}

export class DemoPeople implements PeopleRepository {
  constructor(
    private state: DemoState,
    private persist: () => void,
  ) {}

  private get me() {
    return this.state.profile ?? DEFAULT_PROFILE;
  }

  private isFollowing(id: string) {
    return (this.state.following ?? []).includes(id);
  }

  private myCard(): PersonCard {
    return {
      id: ME,
      username: this.me.username,
      displayName: this.me.displayName ?? this.me.username,
      bio: this.me.bio,
      followers: DEMO_PEOPLE.filter((d) => d.followsMe).length,
      following: (this.state.following ?? []).length,
      plants: this.state.plants.length,
      isFollowing: false,
      followsMe: false,
      isMe: true,
    };
  }

  private card(d: (typeof DEMO_PEOPLE)[number]): PersonCard {
    const id = demoId(d.username);
    return {
      id,
      username: d.username,
      displayName: d.displayName,
      bio: d.bio,
      followers: d.followers + (this.isFollowing(id) ? 1 : 0),
      following: DEMO_PEOPLE.length - 1 + (d.followsMe ? 1 : 0),
      plants: d.plants.length,
      isFollowing: this.isFollowing(id),
      followsMe: d.followsMe,
      isMe: false,
    };
  }

  private all() {
    return [this.myCard(), ...DEMO_PEOPLE.map((d) => this.card(d))];
  }

  async search(query: string) {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    if (!q) return DEMO_PEOPLE.map((d) => this.card(d)).sort((a, b) => b.followers - a.followers);
    return this.all().filter((p) => p.username.toLowerCase().includes(q) || p.displayName.toLowerCase().includes(q));
  }

  async byUsername(username: string) {
    return this.all().find((p) => p.username === username) ?? null;
  }

  async followers(userId: string) {
    if (userId === ME) return DEMO_PEOPLE.filter((d) => d.followsMe).map((d) => this.card(d));
    const others = DEMO_PEOPLE.filter((d) => demoId(d.username) !== userId).map((d) => this.card(d));
    return this.isFollowing(userId) ? [this.myCard(), ...others] : others;
  }

  async following(userId: string) {
    if (userId === ME) return DEMO_PEOPLE.filter((d) => this.isFollowing(demoId(d.username))).map((d) => this.card(d));
    const person = DEMO_PEOPLE.find((d) => demoId(d.username) === userId);
    const others = DEMO_PEOPLE.filter((d) => demoId(d.username) !== userId).map((d) => this.card(d));
    return person?.followsMe ? [this.myCard(), ...others] : others;
  }

  async plantsOf(userId: string): Promise<PublicPlant[]> {
    if (userId === ME)
      return this.state.plants.map((p) => ({ id: p.id, nickname: p.nickname, speciesSlug: p.speciesSlug, photoUrl: this.state.photos[p.id] ?? null }));
    const person = DEMO_PEOPLE.find((d) => demoId(d.username) === userId);
    return (person?.plants ?? []).map(([nickname, slug], i) => ({ id: `${userId}-plant-${i}`, nickname, speciesSlug: slug, photoUrl: null }));
  }

  async updateProfile(update: ProfileUpdate): Promise<Profile> {
    const invalid = validateProfile(update);
    if (invalid) throw new Error(invalid.message);
    if (DEMO_PEOPLE.some((d) => d.username === update.username)) throw new Error(`Имя @${update.username} уже занято — выберите другое`);
    this.state.profile = { username: update.username, displayName: update.displayName.trim(), bio: update.bio.trim() || null };
    this.persist();
    return this.state.profile;
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

  const hours = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
  const speciesId = (slug: string) => ALL_SPECIES.find((s) => s.slug === slug)?.id ?? null;
  SAMPLE_DIARIES.forEach(([author, plant, slug, event, text, likes], i) => {
    const id = `demo-post-${i}`;
    state.posts.push({
      id,
      kind: "diary",
      event,
      speciesId: speciesId(slug),
      solvedCommentId: null,
      authorId: demoId(author),
      authorName: author,
      text,
      createdAt: hours(3 + i * 7),
      plantId: null,
      plantName: plant,
      photoUrl: null,
      likeCount: likes,
      commentCount: 2,
      likedByMe: false,
    });
    state.comments.push(
      { id: `${id}-c1`, postId: id, authorName: "fikus_papa", text: "Какая красота! Чем подкармливаете?", createdAt: hours(2), mine: false },
      { id: `${id}-c2`, postId: id, authorName: "succulove", text: "Сохранила себе в вишлист 🌿", createdAt: hours(0.7), mine: false },
    );
  });
  SAMPLE_QUESTIONS.forEach(([author, slug, text, answers, best], i) => {
    const id = `demo-question-${i}`;
    state.posts.push({
      id,
      kind: "question",
      event: null,
      speciesId: speciesId(slug),
      solvedCommentId: best === null ? null : `${id}-a${best}`,
      authorId: demoId(author),
      authorName: author,
      text,
      createdAt: hours(5 + i * 9),
      plantId: null,
      plantName: null,
      photoUrl: null,
      likeCount: 0,
      commentCount: answers.length,
      likedByMe: false,
    });
    answers.forEach(([who, answer], j) =>
      state.comments.push({ id: `${id}-a${j}`, postId: id, authorName: who, text: answer, createdAt: hours(4 + i * 9 - j), mine: false }),
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
    people: new DemoPeople(s, persist),
    identifier: null,
    profile: async () => s.profile ?? DEFAULT_PROFILE,
  };
}
