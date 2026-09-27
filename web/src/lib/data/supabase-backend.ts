import type { SupabaseClient } from "@supabase/supabase-js";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { eventFromRow, scheduleFromRow, taskFromRow, type CareType } from "../domain/care";
import { statsFromRow } from "../domain/gamification";
import type { DiseaseGuess } from "../domain/diagnosis";
import type { Prediction } from "../domain/identification";
import { personFromRow, validateProfile, type ProfileUpdate } from "../domain/people";
import { coverPathOf, plantFromRow, type Location } from "../domain/plant";
import { commentFromRow, newsFromRow, postFromRow, type DiaryScope, type HelpFilter, type NewPost, type PostUpdate, type ReaderArticle } from "../domain/social";
import { careFromRow } from "../domain/species";
import { blobToBase64 } from "../image";
import { initialSchedules } from "./schedules";
import {
  conversationFromRow,
  listingFromRow,
  messageFromRow,
  validateListing,
  type ChatMessage,
  type ListingDraft,
  type ListingFilter,
  type ListingStatus,
} from "../domain/market";
import { offerFromRow, productFromRow, shopFromRow, normalizeWebsite, validateShop, type ProductInput, type ShopDraft, type ShopStatus } from "../domain/shop";
import type {
  Backend,
  ChatRepository,
  NotificationSettings,
  NotificationsRepository,
  GardenRepository,
  MarketRepository,
  PeopleRepository,
  PlantDraft,
  PlantIdentifier,
  Profile,
  ShopRepository,
  SocialRepository,
  WishlistRepository,
} from "./types";

const PLANT_SELECT =
  "*, species(slug, latin_name, common_names), locations(name, light_level), care_schedules(type, next_due_at), " +
  "cover:plant_photos!plants_cover_photo_fk(storage_path)";
const PLANT_BUCKET = "plant-photos";
const POST_BUCKET = "post-photos";
const POST_SELECT = "*, author:profiles!posts_author_id_fkey(username, display_name), plant:plants(nickname)";
const COMMENT_SELECT = "*, author:profiles!comments_author_id_fkey(username, display_name)";

type Row = Record<string, unknown>;

/** Ошибки PostgREST/Storage превращаем в исключения — экраны показывают их текст. */
function check(res: { data: unknown; error: { message: string; code?: string } | null }): unknown {
  if (res.error) throw Object.assign(new Error(res.error.message), { code: res.error.code });
  return res.data;
}

/** Подписанные ссылки на приватные фото одним запросом. */
const profileFromRow = (r: Row): Profile => ({
  username: r.username as string,
  displayName: (r.display_name as string | null) ?? null,
  bio: (r.bio as string | null) ?? null,
  city: (r.city as string | null) ?? null,
  isAdmin: Boolean(r.is_admin),
});
const PROFILE_FIELDS = "username, display_name, bio, city, is_admin";

/**
 * В снимке базы знаний id вида = slug, а в базе — uuid. Сайт везде работает со slug,
 * поэтому на входе и выходе переводим. Справочник (≈250 строк) грузится один раз.
 */
export class SpeciesIds {
  private maps: Promise<{ slugOf: Map<string, string>; uuidOf: Map<string, string> }> | null = null;
  constructor(private db: SupabaseClient) {}

  private load() {
    this.maps ??= (async () => {
      const rows = check(await this.db.from("species").select("id, slug")) as Row[];
      return {
        slugOf: new Map(rows.map((r) => [r.id as string, r.slug as string])),
        uuidOf: new Map(rows.map((r) => [r.slug as string, r.id as string])),
      };
    })().catch((e) => {
      this.maps = null;
      throw e;
    });
    return this.maps;
  }

  /** uuid → slug (для строк из базы). */
  async slugs() {
    const { slugOf } = await this.load();
    return (id: string | null | undefined) => (id ? (slugOf.get(id) ?? null) : null);
  }

  /** slug → uuid (для записи в базу); неизвестный вид — null. */
  async uuids() {
    const { uuidOf } = await this.load();
    return (slug: string | null | undefined) => (slug ? (uuidOf.get(slug) ?? null) : null);
  }
}

async function signedUrls(db: SupabaseClient, bucket: string, paths: string[]): Promise<Map<string, string>> {
  if (!paths.length) return new Map();
  const { data } = await db.storage.from(bucket).createSignedUrls(paths, 3600);
  return new Map(
    (data ?? []).flatMap((s) => (s.signedUrl && s.path ? [[s.path, s.signedUrl] as [string, string]] : [])),
  );
}

/**
 * Работа с Supabase. Доступ ограничивают RLS-политики на сервере, пересчёт графиков
 * делают триггеры (см. supabase/migrations).
 */
export class SupabaseGarden implements GardenRepository {
  constructor(private db: SupabaseClient, private uid: string) {}

  private async withPhotos(rows: Row[]) {
    const urls = await signedUrls(this.db, PLANT_BUCKET, rows.map(coverPathOf).filter((p): p is string => !!p));
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
    const rows = check(
      await this.db.from("locations").select().eq("owner_id", this.uid).is("deleted_at", null).order("name"),
    ) as Row[];
    return rows.map((r) => ({ id: r.id as string, name: r.name as string, lightLevel: (r.light_level as never) ?? null }));
  }

  async addLocation(name: string, light: Location["lightLevel"]) {
    const r = check(
      await this.db.from("locations").insert({ id: crypto.randomUUID(), name, light_level: light }).select().single(),
    ) as Row;
    return { id: r.id as string, name: r.name as string, lightLevel: (r.light_level as never) ?? null };
  }

  async updateLocation(id: string, name: string, light: Location["lightLevel"]) {
    const r = check(
      await this.db.from("locations").update({ name: name.trim(), light_level: light }).eq("id", id).eq("owner_id", this.uid).select().single(),
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
      this.db.from("plants").select("id", { count: "exact", head: true }).eq("owner_id", this.uid).eq("in_water", true).is("deleted_at", null),
    ]);
    return { ...statsFromRow(check(row) as Row), inWater: inWater.count ?? 0 };
  }
}

export class SupabaseSocial implements SocialRepository {
  constructor(private db: SupabaseClient, private uid: string, private species: SpeciesIds) {}

  /** Подписанные ссылки на фото и отметка «мне нравится». */
  private async hydrate(rows: Row[]) {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id as string);
    const firstPhoto = (r: Row) => ((r.photo_paths as string[] | null) ?? [])[0];
    const authors = [...new Set(rows.map((r) => r.author_id as string))];
    const [liked, follows, urls, slugOf] = await Promise.all([
      this.db.from("likes").select("post_id").eq("user_id", this.uid).in("post_id", ids),
      this.db.from("follows").select("followee_id").eq("follower_id", this.uid).in("followee_id", authors),
      signedUrls(this.db, POST_BUCKET, rows.map(firstPhoto).filter(Boolean)),
      this.species.slugs(),
    ]);
    const likedIds = new Set((check(liked) as Row[]).map((l) => l.post_id as string));
    const followed = new Set((check(follows) as Row[]).map((f) => f.followee_id as string));
    return rows.map((r) => ({
      ...postFromRow(r, {
        likedByMe: likedIds.has(r.id as string),
        following: followed.has(r.author_id as string),
        photoUrl: urls.get(firstPhoto(r)) ?? null,
        myId: this.uid,
      }),
      speciesId: slugOf(r.species_id as string | null),
    }));
  }

  async diaries(scope: DiaryScope) {
    const rows = check(await this.db.rpc("feed_diaries", { scope, lim: 30 }).select(POST_SELECT)) as Row[];
    return this.hydrate(rows);
  }

  async plantDiary(plantId: string) {
    const rows = check(
      await this.db
        .from("posts")
        .select(POST_SELECT)
        .eq("plant_id", plantId)
        .in("kind", ["milestone", "photo"])
        .is("deleted_at", null)
        .order("created_at")
        .limit(100),
    ) as Row[];
    return this.hydrate(rows);
  }

  async questions(filter: HelpFilter) {
    const rows = check(await this.db.rpc("help_questions", { filter, lim: 40 }).select(POST_SELECT)) as Row[];
    return this.hydrate(rows);
  }

  async post(id: string) {
    const row = check(await this.db.from("posts").select(POST_SELECT).eq("id", id).is("deleted_at", null).maybeSingle()) as Row | null;
    return row ? (await this.hydrate([row]))[0] : null;
  }

  async markSolved(postId: string, commentId: string | null) {
    check(await this.db.from("posts").update({ solved_comment_id: commentId }).eq("id", postId).eq("author_id", this.uid));
  }

  async news(onlyMySpecies = false, langs: string[] = []) {
    const rows = check(
      await this.db.rpc("news_feed", { lim: 50, only_my_species: onlyMySpecies, langs: langs.length ? langs : null }),
    ) as Row[];
    const slugOf = await this.species.slugs();
    return rows.map((r) => {
      const n = newsFromRow(r);
      return { ...n, speciesIds: n.speciesIds.map(slugOf).filter((x): x is string => !!x) };
    });
  }

  async readArticle(id: string): Promise<ReaderArticle | null> {
    const { data, error } = await this.db.functions.invoke("news-reader", { body: { id } });
    if (error) throw new Error("Не удалось загрузить текст статьи");
    return data as ReaderArticle;
  }

  async createPost(post: NewPost) {
    const id = crypto.randomUUID();
    const paths: string[] = [];
    if (post.photo) {
      const path = `${this.uid}/${id}/0.jpg`;
      check(await this.db.storage.from(POST_BUCKET).upload(path, post.photo, { contentType: "image/jpeg" }));
      paths.push(path);
    }
    const row = check(
      await this.db
        .from("posts")
        .insert({
          id,
          text: post.text,
          plant_id: post.plantId ?? null,
          photo_paths: paths,
          visibility: post.visibility ?? "public",
          kind: post.kind === "question" ? "question" : "milestone",
          event: post.kind === "diary" ? (post.event ?? "progress") : null,
        })
        .select(POST_SELECT)
        .single(),
    ) as Row;
    return (await this.hydrate([row]))[0];
  }

  async updatePost(id: string, update: PostUpdate) {
    const patch: Row = { text: update.text };
    if (update.event !== undefined) patch.event = update.event;
    const { data, error } = await this.db.from("posts").update(patch).eq("id", id).eq("author_id", this.uid).select(POST_SELECT).maybeSingle();
    if (error) throw new Error(/часа/.test(error.message) ? "Прошло больше часа — публикацию уже нельзя изменить" : error.message);
    if (!data) throw new Error("Публикация не найдена");
    return (await this.hydrate([data as Row]))[0];
  }

  /** Мягкое удаление: публикация пропадает из лент, комментарии остаются в базе. */
  async deletePost(id: string) {
    check(await this.db.from("posts").update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("author_id", this.uid));
  }

  async setLiked(postId: string, liked: boolean) {
    if (liked) {
      check(await this.db.from("likes").upsert({ user_id: this.uid, post_id: postId }, { ignoreDuplicates: true }));
    } else {
      check(await this.db.from("likes").delete().eq("user_id", this.uid).eq("post_id", postId));
    }
  }

  async setFollowing(authorId: string, follow: boolean) {
    if (follow) {
      check(await this.db.from("follows").upsert({ follower_id: this.uid, followee_id: authorId }, { ignoreDuplicates: true }));
    } else {
      check(await this.db.from("follows").delete().eq("follower_id", this.uid).eq("followee_id", authorId));
    }
  }

  async comments(postId: string) {
    const rows = check(
      await this.db
        .from("comments")
        .select(COMMENT_SELECT)
        .eq("post_id", postId)
        .is("deleted_at", null)
        .order("created_at")
        .limit(200),
    ) as Row[];
    return rows.map((r) => commentFromRow(r, this.uid));
  }

  async addComment(postId: string, text: string) {
    const row = check(
      await this.db.from("comments").insert({ id: crypto.randomUUID(), post_id: postId, text }).select(COMMENT_SELECT).single(),
    ) as Row;
    return commentFromRow(row, this.uid);
  }

  /** Мягкое удаление: счётчик комментариев поправит триггер. */
  async deleteComment(commentId: string) {
    check(await this.db.from("comments").update({ deleted_at: new Date().toISOString() }).eq("id", commentId));
  }

  async myActivity() {
    const [posts, answers, followers] = await Promise.all([
      this.db.from("posts").select("like_count").eq("author_id", this.uid).is("deleted_at", null),
      // Свои ответы на вопросы: у comments и posts две связи (post_id и solved_comment_id) — указываем нужную.
      this.db
        .from("comments")
        .select("id, post:posts!comments_post_id_fkey!inner(kind, solved_comment_id)")
        .eq("author_id", this.uid)
        .eq("post.kind", "question")
        .limit(5000),
      this.db.from("follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", this.uid),
    ]);
    const rows = check(posts) as Row[];
    const mine = check(answers) as Row[];
    return {
      posts: rows.length,
      likesReceived: rows.reduce((sum, r) => sum + Number(r.like_count), 0),
      answers: mine.length,
      bestAnswers: mine.filter((r) => (r.post as { solved_comment_id?: string | null } | null)?.solved_comment_id === r.id).length,
      followers: followers.count ?? 0,
    };
  }
}

/** Pl@ntNet через Edge Function identify-plant (квота 20 в день на пользователя). */
export class SupabasePeople implements PeopleRepository {
  constructor(private db: SupabaseClient, private uid: string) {}

  async search(query: string) {
    const rows = check(await this.db.rpc("search_people", { q: query.trim(), lim: 30 })) as Row[];
    return rows.map(personFromRow);
  }

  async byUsername(username: string) {
    const row = check(await this.db.from("profile_cards").select().eq("username", username.toLowerCase()).maybeSingle());
    return row ? personFromRow(row as Row) : null;
  }

  async followers(userId: string) {
    return (check(await this.db.rpc("people_followers", { p_user: userId })) as Row[]).map(personFromRow);
  }

  async following(userId: string) {
    return (check(await this.db.rpc("people_following", { p_user: userId })) as Row[]).map(personFromRow);
  }

  async plantsOf(userId: string) {
    // RLS отдаёт только растения, которые разрешено видеть (публичные и «для подписчиков»).
    const rows = check(
      await this.db
        .from("plants")
        .select("id, nickname, species(slug), cover:plant_photos!plants_cover_photo_fk(storage_path)")
        .eq("owner_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
    ) as Row[];
    const urls = await signedUrls(this.db, PLANT_BUCKET, rows.map(coverPathOf).filter((p): p is string => !!p));
    return rows.map((r) => ({
      id: r.id as string,
      nickname: r.nickname as string,
      speciesSlug: (r.species as { slug?: string } | null)?.slug ?? null,
      photoUrl: urls.get(coverPathOf(r) ?? "") ?? null,
    }));
  }

  async updateProfile(update: ProfileUpdate): Promise<Profile> {
    const invalid = validateProfile(update);
    if (invalid) throw new Error(invalid.message);
    const { data, error } = await this.db
      .from("profiles")
      .update({
        display_name: update.displayName.trim(),
        username: update.username,
        bio: update.bio.trim() || null,
        ...(update.city !== undefined ? { city: update.city.trim() || null } : {}),
      })
      .eq("id", this.uid)
      .select(PROFILE_FIELDS)
      .single();
    if (error?.code === "23505") throw new Error(`Имя @${update.username} уже занято — выберите другое`);
    if (error) throw new Error(error.message);
    return profileFromRow(data as Row);
  }
}

export class PlantNetIdentifier implements PlantIdentifier {
  constructor(private db: SupabaseClient) {}

  private async call(jpeg: Blob, mode: "species" | "diseases") {
    const { data, error } = await this.db.functions.invoke("identify-plant", {
      body: { image_base64: await blobToBase64(jpeg), organ: "auto", mode },
    });
    if (error) {
      const status = error instanceof FunctionsHttpError ? error.context.status : 0;
      if (status === 429) throw new Error("Лимит распознаваний на сегодня исчерпан — попробуйте завтра.");
      if (status === 401) throw new Error("Войдите, чтобы распознавать растения.");
      throw new Error("Сервис распознавания недоступен, попробуйте позже.");
    }
    return data as { results?: Row[]; diseases?: Row[] } | null;
  }

  async diagnose(jpeg: Blob): Promise<DiseaseGuess[]> {
    const data = await this.call(jpeg, "diseases");
    return (data?.diseases ?? []).map((r) => ({ eppo: String(r.eppo), score: Number(r.score), name: String(r.name ?? r.eppo) }));
  }

  async identify(jpeg: Blob): Promise<Prediction[]> {
    const data = await this.call(jpeg, "species");
    const results = ((data as { results?: Row[] } | null)?.results ?? []) as Row[];
    return results.map((r) => ({
      label: r.name as string,
      score: Number(r.score),
      commonName: ((r.common_names as string[] | null) ?? [])[0] ?? null,
    }));
  }
}

const LISTING_BUCKET = "listing-photos";
const LISTING_SELECT = "*, seller:profiles!listings_seller_id_fkey(username, display_name)";
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export class SupabaseMarket implements MarketRepository {
  constructor(private db: SupabaseClient, private uid: string, private species: SpeciesIds) {}

  private async hydrate(rows: Row[]) {
    const paths = rows.flatMap((r) => (r.photo_paths as string[] | null) ?? []);
    const [urls, slugOf] = await Promise.all([signedUrls(this.db, LISTING_BUCKET, paths), this.species.slugs()]);
    return rows.map((r) => ({
      ...listingFromRow(r, ((r.photo_paths as string[] | null) ?? []).map((p) => urls.get(p)).filter((u): u is string => !!u), this.uid),
      speciesId: slugOf(r.species_id as string | null),
    }));
  }

  async listings(filter: ListingFilter) {
    let q = this.db.from("listings").select(LISTING_SELECT).is("deleted_at", null).neq("status", "closed");
    if (filter.kind !== "all") q = q.eq("kind", filter.kind);
    if (filter.city) q = q.ilike("city", escapeLike(filter.city.trim()));
    if (filter.deliveryOnly) q = q.eq("delivery", true);
    return this.hydrate(check(await q.order("created_at", { ascending: false }).limit(60)) as Row[]);
  }

  async listing(id: string) {
    const row = check(await this.db.from("listings").select(LISTING_SELECT).eq("id", id).is("deleted_at", null).maybeSingle()) as Row | null;
    return row ? (await this.hydrate([row]))[0] : null;
  }

  async myListings() {
    const rows = check(
      await this.db.from("listings").select(LISTING_SELECT).eq("seller_id", this.uid).is("deleted_at", null).order("created_at", { ascending: false }),
    ) as Row[];
    return this.hydrate(rows);
  }

  private async fields(id: string, d: ListingDraft, keepPaths: string[]) {
    const invalid = validateListing(d, !!d.photo || keepPaths.length > 0);
    if (invalid) throw new Error(invalid.message);
    let paths = keepPaths;
    if (d.photo) {
      const path = `${this.uid}/${id}/${Date.now()}.jpg`;
      check(await this.db.storage.from(LISTING_BUCKET).upload(path, d.photo, { contentType: "image/jpeg" }));
      paths = [path];
    }
    return {
      kind: d.kind,
      title: d.title.trim(),
      description: d.description.trim(),
      species_id: (await this.species.uuids())(d.speciesId),
      price_rub: d.kind === "sell" ? d.priceRub : null,
      swap_for: d.kind === "swap" ? d.swapFor.trim() || null : null,
      city: d.city.trim(),
      delivery: d.delivery,
      photo_paths: paths,
    };
  }

  async createListing(d: ListingDraft) {
    const id = crypto.randomUUID();
    const row = check(
      await this.db.from("listings").insert({ id, ...(await this.fields(id, d, [])) }).select(LISTING_SELECT).single(),
    ) as Row;
    return (await this.hydrate([row]))[0];
  }

  async updateListing(id: string, d: ListingDraft) {
    const cur = check(await this.db.from("listings").select("photo_paths").eq("id", id).eq("seller_id", this.uid).single()) as Row;
    const row = check(
      await this.db
        .from("listings")
        .update(await this.fields(id, d, (cur.photo_paths as string[] | null) ?? []))
        .eq("id", id)
        .eq("seller_id", this.uid)
        .select(LISTING_SELECT)
        .single(),
    ) as Row;
    return (await this.hydrate([row]))[0];
  }

  async setStatus(id: string, status: ListingStatus) {
    check(await this.db.from("listings").update({ status }).eq("id", id).eq("seller_id", this.uid));
  }

  async deleteListing(id: string) {
    check(await this.db.from("listings").update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("seller_id", this.uid));
  }

  /** Удалённые объявления владельцу видны (RLS) и тоже считаются. */
  async myStats() {
    const rows = check(await this.db.from("listings").select("kind, status").eq("seller_id", this.uid).limit(5000)) as Row[];
    return {
      listings: rows.length,
      giveaways: rows.filter((r) => r.kind === "free").length,
      deals: rows.filter((r) => r.status === "closed").length,
    };
  }

  async report(targetType: "listing" | "message" | "profile", targetId: string, reason: string) {
    check(await this.db.from("reports").insert({ target_type: targetType, target_id: targetId, reason }));
  }
}

export class SupabaseChat implements ChatRepository {
  constructor(private db: SupabaseClient, private uid: string) {}

  async conversations() {
    const rows = check(await this.db.rpc("my_conversations")) as Row[];
    const urls = await signedUrls(this.db, LISTING_BUCKET, rows.map((r) => r.listing_photo as string | null).filter((p): p is string => !!p));
    return rows.map((r) => conversationFromRow(r, urls.get((r.listing_photo as string | null) ?? "") ?? null));
  }

  async start(listingId: string) {
    const { data, error } = await this.db.rpc("start_conversation", { p_listing: listingId });
    if (error) throw new Error(error.message);
    return data as string;
  }

  async messages(conversationId: string) {
    const rows = check(
      await this.db.from("messages").select("*").eq("conversation_id", conversationId).order("created_at").limit(500),
    ) as Row[];
    return rows.map((r) => messageFromRow(r, this.uid));
  }

  async send(conversationId: string, body: string): Promise<ChatMessage> {
    const { data, error } = await this.db
      .from("messages")
      .insert({ id: crypto.randomUUID(), conversation_id: conversationId, body: body.trim() })
      .select()
      .single();
    if (error?.code === "42501") throw new Error("Написать нельзя: кто-то из вас заблокировал другого");
    if (error) throw new Error(error.message);
    return messageFromRow(data as Row, this.uid);
  }

  async markRead(conversationId: string) {
    check(await this.db.rpc("mark_conversation_read", { p_conversation: conversationId }));
  }

  subscribe(conversationId: string, onMessage: (m: ChatMessage) => void) {
    const channel = this.db
      .channel(`chat:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => onMessage(messageFromRow(payload.new as Row, this.uid)),
      )
      .subscribe();
    return () => void this.db.removeChannel(channel);
  }

  async block(userId: string) {
    check(await this.db.from("blocks").upsert({ blocker_id: this.uid, blocked_id: userId }, { ignoreDuplicates: true }));
  }
}

export class SupabaseNotifications implements NotificationsRepository {
  constructor(private db: SupabaseClient, private uid: string) {}

  async publicKey() {
    const { data, error } = await this.db.functions.invoke("push", { body: { action: "config" } });
    if (error || !(data as { publicKey?: string } | null)?.publicKey) throw new Error("Сервис уведомлений недоступен, попробуйте позже");
    return (data as { publicKey: string }).publicKey;
  }

  async subscribe(sub: { endpoint: string; p256dh: string; auth: string }, userAgent: string) {
    check(
      await this.db.rpc("save_push_subscription", { p_endpoint: sub.endpoint, p_p256dh: sub.p256dh, p_auth: sub.auth, p_user_agent: userAgent }),
    );
  }

  async unsubscribe(endpoint: string) {
    check(await this.db.from("push_subscriptions").delete().eq("endpoint", endpoint));
  }

  async settings(): Promise<NotificationSettings> {
    const r = check(
      await this.db.from("profiles").select("notify_care, notify_messages, notify_community, notify_wishlist, reminder_time, timezone").eq("id", this.uid).single(),
    ) as Row;
    return {
      care: Boolean(r.notify_care),
      messages: Boolean(r.notify_messages),
      community: Boolean(r.notify_community),
      wishlist: Boolean(r.notify_wishlist),
      reminderTime: String(r.reminder_time ?? "09:00").slice(0, 5),
      timezone: (r.timezone as string | null) ?? "UTC",
    };
  }

  async updateSettings(patch: Partial<NotificationSettings>) {
    const row: Row = {};
    if (patch.care !== undefined) row.notify_care = patch.care;
    if (patch.messages !== undefined) row.notify_messages = patch.messages;
    if (patch.community !== undefined) row.notify_community = patch.community;
    if (patch.wishlist !== undefined) row.notify_wishlist = patch.wishlist;
    if (patch.reminderTime !== undefined) row.reminder_time = patch.reminderTime;
    if (patch.timezone !== undefined) row.timezone = patch.timezone;
    check(await this.db.from("profiles").update(row).eq("id", this.uid));
  }
}

const SHOP_FIELDS = "id, owner_id, name, description, inn, city, address, hours, phone, website, delivery, status, review_note, created_at, verified_at";
const PRODUCT_FIELDS = "id, external_id, title, species_id, price_rub, in_stock, pot_cm, height_cm, url, image_url";
const IMPORT_CHUNK = 1000;

export class SupabaseShops implements ShopRepository {
  constructor(private db: SupabaseClient, private uid: string, private species: SpeciesIds) {}

  async myShop() {
    const row = check(await this.db.from("shops").select(SHOP_FIELDS).eq("owner_id", this.uid).maybeSingle()) as Row | null;
    return row ? shopFromRow(row, this.uid) : null;
  }

  async saveShop(d: ShopDraft) {
    const invalid = validateShop(d);
    if (invalid) throw new Error(invalid.message);
    const fields = {
      name: d.name.trim(),
      description: d.description.trim(),
      inn: d.inn.trim() || null,
      city: d.city.trim(),
      address: d.address.trim() || null,
      hours: d.hours.trim() || null,
      phone: d.phone.trim() || null,
      website: normalizeWebsite(d.website),
      delivery: d.delivery,
    };
    const existing = await this.myShop();
    const res = existing
      ? await this.db.from("shops").update(fields).eq("id", existing.id).select(SHOP_FIELDS).single()
      : await this.db.from("shops").insert(fields).select(SHOP_FIELDS).single();
    if (res.error?.code === "23505") throw new Error("У вас уже есть магазин");
    return shopFromRow(check(res) as Row, this.uid);
  }

  async shop(id: string) {
    const row = check(await this.db.from("shops").select(SHOP_FIELDS).eq("id", id).maybeSingle()) as Row | null;
    return row ? shopFromRow(row, this.uid) : null;
  }

  async shops(city: string | null) {
    const rows = check(await this.db.from("shops").select(SHOP_FIELDS).eq("status", "verified").order("name").limit(200)) as Row[];
    const list = rows.map((r) => shopFromRow(r, this.uid));
    const here = (s: { city: string }) => !!city && s.city.trim().toLowerCase() === city.trim().toLowerCase();
    return list.sort((a, b) => Number(here(b)) - Number(here(a)));
  }

  async products(shopId: string) {
    const [rows, slugOf] = await Promise.all([
      this.db.from("shop_products").select(PRODUCT_FIELDS).eq("shop_id", shopId).order("title").limit(5000),
      this.species.slugs(),
    ]);
    return (check(rows) as Row[]).map((r) => ({ ...productFromRow(r), speciesId: slugOf(r.species_id as string | null) }));
  }

  async importProducts(rows: ProductInput[], replace: boolean) {
    const uuidOf = await this.species.uuids();
    const payload = rows.map((p) => ({
      external_id: p.externalId,
      title: p.title,
      species_id: uuidOf(p.speciesId),
      price_rub: p.priceRub,
      in_stock: p.inStock,
      pot_cm: p.potCm,
      height_cm: p.heightCm,
      url: p.url,
      image_url: p.imageUrl,
    }));
    // Один вызов — одна транзакция; при замене каталога файл обязан уйти целиком.
    if (replace || payload.length <= IMPORT_CHUNK) {
      const r = (check(await this.db.rpc("shop_import_products", { p_rows: payload, p_replace: replace })) as Row[])[0] ?? {};
      return { inserted: Number(r.inserted ?? 0), updated: Number(r.updated ?? 0), deleted: Number(r.deleted ?? 0) };
    }
    const total = { inserted: 0, updated: 0, deleted: 0 };
    for (let i = 0; i < payload.length; i += IMPORT_CHUNK) {
      const r = (check(await this.db.rpc("shop_import_products", { p_rows: payload.slice(i, i + IMPORT_CHUNK), p_replace: false })) as Row[])[0] ?? {};
      total.inserted += Number(r.inserted ?? 0);
      total.updated += Number(r.updated ?? 0);
    }
    return total;
  }

  async setInStock(productId: string, inStock: boolean) {
    check(await this.db.from("shop_products").update({ in_stock: inStock }).eq("id", productId));
  }

  async deleteProduct(productId: string) {
    check(await this.db.from("shop_products").delete().eq("id", productId));
  }

  async whereToBuy(speciesId: string, city: string | null) {
    const uuid = (await this.species.uuids())(speciesId);
    if (!uuid) return [];
    const rows = check(await this.db.rpc("where_to_buy", { p_species: uuid, p_city: city?.trim() || null })) as Row[];
    return rows.map(offerFromRow);
  }

  async reviewQueue() {
    const rows = check(await this.db.from("shops").select(SHOP_FIELDS).order("created_at", { ascending: false }).limit(200)) as Row[];
    const order: Record<ShopStatus, number> = { pending: 0, suspended: 1, rejected: 2, verified: 3 };
    return rows.map((r) => shopFromRow(r, this.uid)).sort((a, b) => order[a.status] - order[b.status]);
  }

  async myStats() {
    const shop = await this.myShop();
    if (!shop) return { hasShop: 0, shopVerified: 0, products: 0, shopSpecies: 0 };
    const rows = check(await this.db.from("shop_products").select("species_id").eq("shop_id", shop.id).limit(5000)) as Row[];
    return {
      hasShop: 1,
      shopVerified: shop.status === "verified" ? 1 : 0,
      products: rows.length,
      shopSpecies: new Set(rows.map((r) => r.species_id).filter(Boolean)).size,
    };
  }

  async review(shopId: string, status: ShopStatus, note: string) {
    check(await this.db.rpc("review_shop", { p_shop: shopId, p_status: status, p_note: note.trim() || null }));
  }
}

export class SupabaseWishlist implements WishlistRepository {
  constructor(private db: SupabaseClient, private uid: string, private species: SpeciesIds) {}

  async list() {
    const [rows, slugOf] = await Promise.all([
      this.db.from("wishlist_items").select("species_id").eq("user_id", this.uid).order("created_at", { ascending: false }),
      this.species.slugs(),
    ]);
    return (check(rows) as Row[]).map((r) => slugOf(r.species_id as string)).filter((x): x is string => !!x);
  }

  async set(speciesId: string, wanted: boolean) {
    const uuid = (await this.species.uuids())(speciesId);
    if (!uuid) throw new Error("Вид не найден");
    if (wanted) check(await this.db.from("wishlist_items").upsert({ user_id: this.uid, species_id: uuid }, { ignoreDuplicates: true }));
    else check(await this.db.from("wishlist_items").delete().eq("user_id", this.uid).eq("species_id", uuid));
  }
}

export function supabaseBackend(db: SupabaseClient, uid: string): Backend {
  const species = new SpeciesIds(db);
  return {
    mode: "live",
    garden: new SupabaseGarden(db, uid),
    social: new SupabaseSocial(db, uid, species),
    people: new SupabasePeople(db, uid),
    market: new SupabaseMarket(db, uid, species),
    chat: new SupabaseChat(db, uid),
    shops: new SupabaseShops(db, uid, species),
    wishlist: new SupabaseWishlist(db, uid, species),
    notifications: new SupabaseNotifications(db, uid),
    identifier: new PlantNetIdentifier(db),
    async profile() {
      return profileFromRow(check(await db.from("profiles").select(PROFILE_FIELDS).eq("id", uid).single()) as Row);
    },
  };
}
