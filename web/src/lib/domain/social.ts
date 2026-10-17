/** Сообщество: записи дневников, вопросы, комментарии и новости. */

import { prettyUsername } from "./people";

/** «Дневники»: записи подписок или все публичные. */
export type DiaryScope = "following" | "all";
/** «Помощь»: без лучшего ответа, про мои виды, мои вопросы, все. */
export type HelpFilter = "open" | "my_species" | "mine" | "all";

export type PostKind = "diary" | "question";

/** События из жизни растения — о чём запись в дневнике. */
export const DIARY_EVENTS = {
  new_leaf: { label: "Новый лист", emoji: "🌱" },
  bloom: { label: "Цветение", emoji: "🌸" },
  repot: { label: "Пересадка", emoji: "🪴" },
  cutting: { label: "Черенок или детка", emoji: "✂️" },
  rescue: { label: "Спасение", emoji: "🩹" },
  progress: { label: "Как растёт", emoji: "📏" },
  care: { label: "Уход", emoji: "🚿" },
  tip: { label: "Совет", emoji: "💡" },
} as const;
export type DiaryEvent = keyof typeof DIARY_EVENTS;
const isDiaryEvent = (v: unknown): v is DiaryEvent => typeof v === "string" && v in DIARY_EVENTS;

export interface FeedPost {
  id: string;
  kind: PostKind;
  /** Для записей дневника; у старых постов — «Как растёт». */
  event: DiaryEvent | null;
  /** id вида из базы знаний (для вопросов — фильтр «Мои виды»). */
  speciesId: string | null;
  /** Лучший ответ на вопрос (id комментария). */
  solvedCommentId: string | null;
  /** Когда автор последний раз правил текст; null — не правил. */
  editedAt: Date | null;
  authorId: string;
  /** username автора (без @) — для ссылки на профиль. */
  authorName: string;
  /** Имя, которое автор указал в профиле. */
  authorDisplayName: string;
  /** Автор — команда «Подоконника» (администратор). */
  authorIsTeam: boolean;
  text: string;
  createdAt: Date;
  plantId: string | null;
  plantName: string | null;
  /** Все растения записи: главное первым, затем отмеченные вместе с ним (душ всем, новая подсветка). */
  plants: { id: string; name: string }[];
  /** Обложка — первое фото. */
  photoUrl: string | null;
  /** Все фото публикации по порядку (обложка — первое). */
  photoUrls: string[];
  /** Чем фото обозначены при правке (путь в хранилище) — по одному на каждую ссылку photoUrls. */
  photoKeys: string[];
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  mine: boolean;
  /** Я подписан на автора. */
  following: boolean;
}

/** Комментарии веткой: корневые по времени, под каждым — его ответы. */
export function commentThreads(list: PostComment[]): { root: PostComment; replies: PostComment[] }[] {
  const roots = list.filter((c) => !c.parentId || !list.some((x) => x.id === c.parentId));
  return roots.map((root) => ({ root, replies: list.filter((c) => c.parentId === root.id) }));
}

/** Сколько после публикации её можно редактировать (удалять — всегда). */
export const EDIT_WINDOW_MS = 60 * 60 * 1000;

/** Сколько фото можно приложить к публикации. */
export const POST_PHOTOS_MAX = 5;

/** Сколько миллисекунд ещё можно редактировать; 0 — уже нельзя или пост чужой. */
export function editTimeLeft(post: Pick<FeedPost, "mine" | "createdAt">, now = new Date()): number {
  if (!post.mine) return 0;
  return Math.max(0, post.createdAt.getTime() + EDIT_WINDOW_MS - now.getTime());
}

/**
 * Новый набор фото записи по порядку (первое — обложка): оставить имеющееся фото (его photoKeys) или добавить снимок.
 * Фото в записи дневника можно менять в любое время, у вопроса — как и текст, в течение часа.
 */
export type PostPhotoEdit = { keep: string } | { add: Blob };

/** Поменять фото можно: в своей записи дневника — всегда, в своём вопросе — пока открыта правка. */
export function canEditPhotos(post: Pick<FeedPost, "mine" | "kind" | "createdAt">, now = new Date()): boolean {
  return post.mine && (post.kind === "diary" || editTimeLeft(post, now) > 0);
}

/** Что автор может поменять в публикации. */
export interface PostUpdate {
  text: string;
  /** Только для записи дневника. */
  event?: DiaryEvent | null;
}

export interface PostComment {
  id: string;
  postId: string;
  /** Корневой комментарий ветки, если это ответ; ответы всегда в одной ветке под корнем. */
  parentId: string | null;
  likeCount: number;
  likedByMe: boolean;
  authorName: string;
  authorDisplayName: string;
  text: string;
  createdAt: Date;
  mine: boolean;
}

export interface NewPost {
  kind: PostKind;
  /** Обязательно для записи дневника. */
  event?: DiaryEvent | null;
  text: string;
  plantId?: string | null;
  /** Ещё растения той же записи (кроме plantId) — запись появится и в их дневниках. */
  alsoPlantIds?: string[];
  /** Фото по порядку; первое — обложка в ленте. */
  photos?: Blob[];
  /** Для постов доступны только «Подписчики» и «Все». */
  visibility?: "followers" | "public";
}

export interface NewsArticle {
  id: string;
  url: string;
  title: string;
  sourceName: string;
  publishedAt: Date;
  summary: string | null;
  imageUrl: string | null;
  speciesIds: string[];
  /** Код языка статьи: ru, en, de… */
  language: string;
}

/** Текст статьи для чтения на сайте (Edge Function news-reader). */
export type ReaderBlock = { type: "p" | "h" | "li" | "quote"; text: string } | { type: "img"; src: string; alt: string };

export interface ReaderArticle {
  url: string;
  title: string;
  byline: string | null;
  siteName: string | null;
  lang: string | null;
  blocks: ReaderBlock[];
}

export const NEWS_LANGUAGES: Record<string, string> = {
  ru: "Русский",
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
};

/** Перевод страницы через Google Переводчик — открывается в браузере, ключи не нужны. */
export const translatedUrl = (url: string, target = "ru") =>
  `https://translate.google.com/translate?sl=auto&tl=${target}&u=${encodeURIComponent(url)}`;

type Row = Record<string, unknown>;

/** Событие «Активности»: кто и что сделал с моими записями и комментариями. */
export interface ActivityItem {
  id: string;
  kind: "comment" | "reply" | "like" | "follow";
  createdAt: Date;
  actorName: string;
  actorDisplayName: string;
  postId: string | null;
  postKind: PostKind | null;
  /** Главное растение записи — по нему ссылка на дневник. */
  plantId: string | null;
  plantName: string | null;
  /** Текст комментария (до 200 символов). */
  text: string | null;
  unread: boolean;
}

export function activityFromRow(r: Row): ActivityItem {
  const username = (r.actor_username as string | null) ?? "садовник";
  return {
    id: r.id as string,
    kind: r.kind as ActivityItem["kind"],
    createdAt: new Date(r.created_at as string),
    actorName: username,
    actorDisplayName: (r.actor_display_name as string | null)?.trim() || prettyUsername(username),
    postId: (r.post_id as string | null) ?? null,
    postKind: r.post_kind == null ? null : r.post_kind === "question" ? "question" : "diary",
    plantId: (r.post_plant_id as string | null) ?? null,
    plantName: (r.plant_name as string | null) ?? null,
    text: (r.text as string | null) ?? null,
    unread: r.unread === true,
  };
}

/** Куда ведёт событие «Активности»: вопрос, дневник растения (к самой записи) или профиль. */
export function activityHref(a: ActivityItem): string {
  if (a.kind === "follow") return `/people/view/?u=${encodeURIComponent(a.actorName)}`;
  if (a.postKind === "question" && a.postId) return `/feed/question/?id=${encodeURIComponent(a.postId)}`;
  if (a.plantId && a.postId) return `/feed/plant/?id=${encodeURIComponent(a.plantId)}#post-${a.postId}`;
  return "/feed/?tab=diaries";
}

/** Ожидает выборку `*, author:profiles(username, display_name), plant:plants(nickname)`. */
/** Главное растение и отмеченные вместе с ним (post_plants), без повторов. */
function postPlants(r: Row): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [];
  const add = (id: unknown, name: unknown) => {
    if (typeof id === "string" && !out.some((p) => p.id === id)) out.push({ id, name: typeof name === "string" ? name : "Растение" });
  };
  add(r.plant_id, (r.plant as { nickname?: string } | null)?.nickname);
  for (const x of (r.extra as { plant_id?: string; plant?: { nickname?: string } | null }[] | null) ?? [])
    add(x.plant_id, x.plant?.nickname);
  return out;
}

export function postFromRow(
  r: Row,
  opts: { photoUrls?: string[]; photoKeys?: string[]; likedByMe?: boolean; following?: boolean; myId?: string | null },
): FeedPost {
  const author = r.author as { username?: string; display_name?: string | null; is_admin?: boolean } | null;
  const plant = r.plant as { nickname?: string } | null;
  const kind = r.kind === "question" ? "question" : "diary";
  return {
    id: r.id as string,
    kind,
    event: kind === "diary" ? (isDiaryEvent(r.event) ? r.event : "progress") : null,
    speciesId: (r.species_id as string | null) ?? null,
    solvedCommentId: (r.solved_comment_id as string | null) ?? null,
    editedAt: r.edited_at ? new Date(r.edited_at as string) : null,
    authorId: r.author_id as string,
    authorName: author?.username ?? "садовник",
    authorDisplayName: author?.display_name?.trim() || prettyUsername(author?.username ?? "садовник"),
    authorIsTeam: author?.is_admin === true,
    text: (r.text as string | null) ?? "",
    createdAt: new Date(r.created_at as string),
    plantId: (r.plant_id as string | null) ?? null,
    plantName: plant?.nickname ?? null,
    plants: postPlants(r),
    photoUrl: opts.photoUrls?.[0] ?? null,
    photoUrls: opts.photoUrls ?? [],
    photoKeys: opts.photoKeys ?? opts.photoUrls ?? [],
    likeCount: (r.like_count as number | null) ?? 0,
    commentCount: (r.comment_count as number | null) ?? 0,
    likedByMe: opts.likedByMe ?? false,
    mine: opts.myId != null && r.author_id === opts.myId,
    following: opts.following ?? false,
  };
}

export function commentFromRow(r: Row, myId: string | null, likedByMe = false): PostComment {
  const author = r.author as { username?: string; display_name?: string | null } | null;
  return {
    id: r.id as string,
    postId: r.post_id as string,
    parentId: (r.parent_id as string | null) ?? null,
    likeCount: Number(r.like_count ?? 0),
    likedByMe,
    authorName: author?.username ?? "садовник",
    authorDisplayName: author?.display_name?.trim() || prettyUsername(author?.username ?? "садовник"),
    text: r.text as string,
    createdAt: new Date(r.created_at as string),
    mine: myId != null && r.author_id === myId,
  };
}

export function newsFromRow(r: Row): NewsArticle {
  return {
    id: r.id as string,
    url: r.url as string,
    title: r.title as string,
    sourceName: r.source_name as string,
    publishedAt: new Date(r.published_at as string),
    summary: (r.summary as string | null) ?? null,
    imageUrl: (r.image_url as string | null) ?? null,
    speciesIds: (r.species_ids as string[] | null) ?? [],
    language: (r.language as string | null) ?? "ru",
  };
}
