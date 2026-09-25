export type FeedTab = "following" | "discover";

export interface FeedPost {
  id: string;
  authorId: string;
  authorName: string;
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
  text: string;
  createdAt: Date;
  mine: boolean;
}

export interface NewPost {
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
}

type Row = Record<string, unknown>;

/** Ожидает выборку `*, author:profiles(username), plant:plants(nickname)`. */
export function postFromRow(
  r: Row,
  opts: { photoUrl?: string | null; likedByMe?: boolean; following?: boolean; myId?: string | null },
): FeedPost {
  const author = r.author as { username?: string } | null;
  const plant = r.plant as { nickname?: string } | null;
  return {
    id: r.id as string,
    authorId: r.author_id as string,
    authorName: author?.username ?? "садовник",
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
  return {
    id: r.id as string,
    postId: r.post_id as string,
    authorName: (r.author as { username?: string } | null)?.username ?? "садовник",
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
  };
}
