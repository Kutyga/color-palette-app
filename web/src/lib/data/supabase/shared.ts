/**
 * Общее для всех репозиториев Supabase: разбор ответов PostgREST, подписанные ссылки
 * на фото, перевод id видов и строки выборок, которые нужны нескольким разделам.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { viaProxy } from "../../net";
import type { Profile } from "../repositories";

/** Строка ответа PostgREST до разбора в модель предметной области. */
export type Row = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Выборки и бакеты Storage
// ---------------------------------------------------------------------------

/** Растение со всем, что нужно карточке: вид, место, ближайшие сроки ухода и обложка. */
export const PLANT_SELECT =
  "*, species(slug, latin_name, common_names), locations(name, light_level), care_schedules(type, next_due_at), " +
  "cover:plant_photos!plants_cover_photo_fk(storage_path)";
export const POST_SELECT = "*, author:profiles!posts_author_id_fkey(username, display_name, is_admin), plant:plants(nickname)";
export const COMMENT_SELECT = "*, author:profiles!comments_author_id_fkey(username, display_name)";
export const PROFILE_FIELDS = "username, display_name, bio, city, is_admin";

/** Приватные бакеты: фото отдаются только по подписанным ссылкам. */
export const PLANT_BUCKET = "plant-photos";
export const POST_BUCKET = "post-photos";
export const LISTING_BUCKET = "listing-photos";

// ---------------------------------------------------------------------------
// Разбор ответов
// ---------------------------------------------------------------------------

/** Ошибки PostgREST/Storage превращаем в исключения — экраны показывают их текст. */
export function check(res: { data: unknown; error: { message: string; code?: string } | null }): unknown {
  if (res.error) throw Object.assign(new Error(res.error.message), { code: res.error.code });
  return res.data;
}

export const profileFromRow = (r: Row): Profile => ({
  username: r.username as string,
  displayName: (r.display_name as string | null) ?? null,
  bio: (r.bio as string | null) ?? null,
  city: (r.city as string | null) ?? null,
  isAdmin: Boolean(r.is_admin),
});

/**
 * Загрузка фото в JPEG. Байтами, а не Blob: Blob supabase-js шлёт формой с полем без имени,
 * а PHP на своём хостинге (SpaceWeb) такие поля выбрасывает. Supabase принимает оба варианта.
 */
export async function uploadJpeg(db: SupabaseClient, bucket: string, path: string, jpeg: Blob) {
  check(await db.storage.from(bucket).upload(path, await jpeg.arrayBuffer(), { contentType: "image/jpeg" }));
}

/** Подписанные ссылки на приватные фото — одним запросом на весь список, живут час. */
export async function signedUrls(db: SupabaseClient, bucket: string, paths: string[]): Promise<Map<string, string>> {
  if (!paths.length) return new Map();
  const { data } = await db.storage.from(bucket).createSignedUrls(paths, 3600);
  // Через свой домен, если Supabase у пользователя заблокирован (картинки грузит браузер напрямую).
  return new Map((data ?? []).flatMap((s) => (s.signedUrl && s.path ? [[s.path, viaProxy(s.signedUrl)] as [string, string]] : [])));
}

// ---------------------------------------------------------------------------
// id видов
// ---------------------------------------------------------------------------

/**
 * В снимке базы знаний id вида = slug, а в базе — uuid. Сайт везде работает со slug,
 * поэтому на входе и выходе переводим. Справочник (≈250 строк) грузится один раз.
 */
export class SpeciesIds {
  private maps: Promise<{ slugOf: Map<string, string>; uuidOf: Map<string, string> }> | null = null;
  constructor(private db: SupabaseClient) {}

  /** Загружает справочник один раз; при ошибке следующая попытка загрузит заново. */
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
