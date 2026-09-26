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
} as const;
export type DiaryEvent = keyof typeof DIARY_EVENTS;
export const isDiaryEvent = (v: unknown): v is DiaryEvent => typeof v === "string" && v in DIARY_EVENTS;

export interface FeedPost {
  id: string;
  kind: PostKind;
  /** Для записей дневника; у старых постов — «Как растёт». */
  event: DiaryEvent | null;
  /** id вида из базы знаний (для вопросов — фильтр «Мои виды»). */
  speciesId: string | null;
  /** Лучший ответ на вопрос (id комментария). */
  solvedCommentId: string | null;
  authorId: string;
  /** username автора (без @) — для ссылки на профиль. */
  authorName: string;
  /** Имя, которое автор указал в профиле. */
  authorDisplayName: string;
  text: string;
  createdAt: Date;
  plantId: string | null;
  plantName: string | null;
  photoUrl: string | null;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  mine: boolean;
  /** Я подписан на автора. */
  following: boolean;
}

export interface PostComment {
  id: string;
  postId: string;
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
  photo?: Blob | null;
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
export type ReaderBlock =
  | { type: "p" | "h" | "li" | "quote"; text: string }
  | { type: "img"; src: string; alt: string };

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

/** Ожидает выборку `*, author:profiles(username, display_name), plant:plants(nickname)`. */
export function postFromRow(
  r: Row,
  opts: { photoUrl?: string | null; likedByMe?: boolean; following?: boolean; myId?: string | null },
): FeedPost {
  const author = r.author as { username?: string; display_name?: string | null } | null;
  const plant = r.plant as { nickname?: string } | null;
  const kind = r.kind === "question" ? "question" : "diary";
  return {
    id: r.id as string,
    kind,
    event: kind === "diary" ? (isDiaryEvent(r.event) ? r.event : "progress") : null,
    speciesId: (r.species_id as string | null) ?? null,
    solvedCommentId: (r.solved_comment_id as string | null) ?? null,
    authorId: r.author_id as string,
    authorName: author?.username ?? "садовник",
    authorDisplayName: author?.display_name?.trim() || prettyUsername(author?.username ?? "садовник"),
    text: (r.text as string | null) ?? "",
    createdAt: new Date(r.created_at as string),
    plantId: (r.plant_id as string | null) ?? null,
    plantName: plant?.nickname ?? null,
    photoUrl: opts.photoUrl ?? null,
    likeCount: (r.like_count as number | null) ?? 0,
    commentCount: (r.comment_count as number | null) ?? 0,
    likedByMe: opts.likedByMe ?? false,
    mine: opts.myId != null && r.author_id === opts.myId,
    following: opts.following ?? false,
  };
}

export function commentFromRow(r: Row, myId: string | null): PostComment {
  const author = r.author as { username?: string; display_name?: string | null } | null;
  return {
    id: r.id as string,
    postId: r.post_id as string,
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
