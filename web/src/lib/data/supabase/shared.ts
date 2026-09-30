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

/**
 * Текст отклонила автомодерация (запрещённые темы, код MOD01) — сообщаем базе о попытке:
 * после трёх за сутки отправка ставится на паузу. База сама перепроверяет текст и хранит
 * только сработавшее правило. Ответ возвращается как есть — ошибку покажет вызывающий.
 */
export function moderated<T extends { error: { code?: string } | null }>(db: SupabaseClient, source: string, text: string, res: T): T {
  if (res.error?.code === "MOD01") void db.rpc("moderation_strike", { p_text: text, p_source: source });
  return res;
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
 * Путь у каждого фото свой и не меняется — браузер может хранить его сколько угодно.
 */
export async function uploadJpeg(db: SupabaseClient, bucket: string, path: string, jpeg: Blob) {
  check(await db.storage.from(bucket).upload(path, await jpeg.arrayBuffer(), { contentType: "image/jpeg", cacheControl: "31536000" }));
}

// Подписанные ссылки живут неделю и запоминаются в браузере: одинаковая ссылка — фото берётся
// из кэша, а не скачивается из Supabase заново (раньше ссылка менялась каждый час, и одно фото
// за сутки скачивалось десятки раз). Сам файл сервис-воркер хранит по пути, без ссылки (public/sw.js).
const SIGN_TTL_S = 7 * 24 * 3600;
/** Ссылку, которой осталось жить меньше суток, подписываем заново. */
const RESIGN_BEFORE_MS = 24 * 3600 * 1000;
/** Ключ в localStorage; при выходе из аккаунта его стирает components/session.tsx. */
const URLS_KEY = "photo-urls";
const MAX_URLS = 600;

type UrlCache = Record<string, { url: string; exp: number }>;
let urlCache: UrlCache | null = null;

function loadUrls(): UrlCache {
  if (urlCache) return urlCache;
  try {
    urlCache = JSON.parse(localStorage.getItem(URLS_KEY) ?? "{}") as UrlCache;
  } catch {
    urlCache = {};
  }
  return urlCache;
}

function saveUrls(cache: UrlCache, now: number) {
  const alive = Object.entries(cache).filter(([, v]) => v.exp - now > RESIGN_BEFORE_MS);
  urlCache = Object.fromEntries(alive.slice(-MAX_URLS));
  try {
    localStorage.setItem(URLS_KEY, JSON.stringify(urlCache));
  } catch {
    // хранилище недоступно или полно — ссылки проживут до перезагрузки
  }
}

/** Подписанные ссылки на приватные фото: запомненные — сразу, недостающие — одним запросом. */
export async function signedUrls(db: SupabaseClient, bucket: string, paths: string[]): Promise<Map<string, string>> {
  if (!paths.length) return new Map();
  const now = Date.now();
  const cache = loadUrls();
  const key = (p: string) => `${bucket}/${p}`;
  const missing = [...new Set(paths)].filter((p) => !((cache[key(p)]?.exp ?? 0) - now > RESIGN_BEFORE_MS));
  if (missing.length) {
    const { data } = await db.storage.from(bucket).createSignedUrls(missing, SIGN_TTL_S);
    for (const s of data ?? []) {
      if (s.signedUrl && s.path) cache[key(s.path)] = { url: s.signedUrl, exp: now + SIGN_TTL_S * 1000 };
    }
    saveUrls(cache, now);
  }
  // Фото всегда идут через свой домен: хостинг хранит копию каждого файла (spaceweb/sb-proxy) —
  // из Supabase фото скачивается один раз, а не каждым посетителем.
  return new Map(paths.flatMap((p) => (cache[key(p)] ? [[p, viaProxy(cache[key(p)].url, true)] as [string, string]] : [])));
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
