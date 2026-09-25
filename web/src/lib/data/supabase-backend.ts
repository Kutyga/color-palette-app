import type { SupabaseClient } from "@supabase/supabase-js";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { eventFromRow, scheduleFromRow, taskFromRow, type CareType } from "../domain/care";
import { statsFromRow } from "../domain/gamification";
import type { Prediction } from "../domain/identification";
import { coverPathOf, plantFromRow, type Location } from "../domain/plant";
import { commentFromRow, newsFromRow, postFromRow, type FeedTab, type NewPost } from "../domain/social";
import { careFromRow } from "../domain/species";
import { blobToBase64 } from "../image";
import { initialSchedules } from "./schedules";
import type { Backend, GardenRepository, PlantDraft, PlantIdentifier, SocialRepository } from "./types";

const PLANT_SELECT =
  "*, species(slug, latin_name, common_names), locations(name, light_level), care_schedules(type, next_due_at), " +
  "cover:plant_photos!plants_cover_photo_fk(storage_path)";
const PLANT_BUCKET = "plant-photos";
const POST_BUCKET = "post-photos";
const POST_SELECT = "*, author:profiles!posts_author_id_fkey(username, display_name), plant:plants(nickname)";
const COMMENT_SELECT = "*, author:profiles!comments_author_id_fkey(username)";

type Row = Record<string, unknown>;

/** Ошибки PostgREST/Storage превращаем в исключения — экраны показывают их текст. */
function check(res: { data: unknown; error: { message: string; code?: string } | null }): unknown {
  if (res.error) throw Object.assign(new Error(res.error.message), { code: res.error.code });
  return res.data;
}

/** Подписанные ссылки на приватные фото одним запросом. */
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
    return statsFromRow(check(await this.db.rpc("my_garden_stats")) as Row);
  }
}

export class SupabaseSocial implements SocialRepository {
  constructor(private db: SupabaseClient, private uid: string) {}

  /** Подписанные ссылки на фото и отметка «мне нравится». */
  private async hydrate(rows: Row[]) {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id as string);
    const firstPhoto = (r: Row) => ((r.photo_paths as string[] | null) ?? [])[0];
    const authors = [...new Set(rows.map((r) => r.author_id as string))];
    const [liked, follows, urls] = await Promise.all([
      this.db.from("likes").select("post_id").eq("user_id", this.uid).in("post_id", ids),
      this.db.from("follows").select("followee_id").eq("follower_id", this.uid).in("followee_id", authors),
      signedUrls(this.db, POST_BUCKET, rows.map(firstPhoto).filter(Boolean)),
    ]);
    const likedIds = new Set((check(liked) as Row[]).map((l) => l.post_id as string));
    const followed = new Set((check(follows) as Row[]).map((f) => f.followee_id as string));
    return rows.map((r) =>
      postFromRow(r, {
        likedByMe: likedIds.has(r.id as string),
        following: followed.has(r.author_id as string),
        photoUrl: urls.get(firstPhoto(r)) ?? null,
        myId: this.uid,
      }),
    );
  }

  async feed(tab: FeedTab) {
    const rows = check(
      await this.db.rpc(tab === "following" ? "feed_following" : "feed_discover", { lim: 30 }).select(POST_SELECT),
    ) as Row[];
    return this.hydrate(rows);
  }

  async news(onlyMySpecies = false) {
    const rows = check(await this.db.rpc("news_feed", { lim: 40, only_my_species: onlyMySpecies })) as Row[];
    return rows.map(newsFromRow);
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
          kind: "photo",
        })
        .select(POST_SELECT)
        .single(),
    ) as Row;
    return (await this.hydrate([row]))[0];
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
    const rows = check(
      await this.db.from("posts").select("like_count").eq("author_id", this.uid).is("deleted_at", null),
    ) as Row[];
    return { posts: rows.length, likesReceived: rows.reduce((sum, r) => sum + Number(r.like_count), 0) };
  }
}

/** Pl@ntNet через Edge Function identify-plant (квота 20 в день на пользователя). */
export class PlantNetIdentifier implements PlantIdentifier {
  constructor(private db: SupabaseClient) {}

  async identify(jpeg: Blob): Promise<Prediction[]> {
    const { data, error } = await this.db.functions.invoke("identify-plant", {
      body: { image_base64: await blobToBase64(jpeg), organ: "auto" },
    });
    if (error) {
      const status = error instanceof FunctionsHttpError ? error.context.status : 0;
      if (status === 429) throw new Error("Лимит распознаваний на сегодня исчерпан — попробуйте завтра.");
      if (status === 401) throw new Error("Войдите, чтобы распознавать растения.");
      throw new Error("Сервис распознавания недоступен, попробуйте позже.");
    }
    const results = ((data as { results?: Row[] } | null)?.results ?? []) as Row[];
    return results.map((r) => ({
      label: r.name as string,
      score: Number(r.score),
      commonName: ((r.common_names as string[] | null) ?? [])[0] ?? null,
    }));
  }
}

export function supabaseBackend(db: SupabaseClient, uid: string): Backend {
  return {
    mode: "live",
    garden: new SupabaseGarden(db, uid),
    social: new SupabaseSocial(db, uid),
    identifier: new PlantNetIdentifier(db),
    async profile() {
      const r = check(await db.from("profiles").select("username, display_name").eq("id", uid).single()) as Row;
      return { username: r.username as string, displayName: (r.display_name as string | null) ?? null };
    },
  };
}
