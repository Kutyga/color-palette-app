/**
 * Сообщество в Supabase: дневники, вопросы «Помощи», комментарии, новости и подписки.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  commentFromRow,
  newsFromRow,
  postFromRow,
  type DiaryScope,
  type HelpFilter,
  type NewPost,
  type PostUpdate,
  type ReaderArticle,
} from "../../domain/social";
import type { SocialRepository } from "../repositories";
import { COMMENT_SELECT, POST_BUCKET, POST_SELECT, type Row, type SpeciesIds, check, signedUrls, uploadJpeg } from "./shared";

export class SupabaseSocial implements SocialRepository {
  constructor(
    private db: SupabaseClient,
    private uid: string,
    private species: SpeciesIds,
  ) {}

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
      await uploadJpeg(this.db, POST_BUCKET, path, post.photo);
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
    const { data, error } = await this.db
      .from("posts")
      .update(patch)
      .eq("id", id)
      .eq("author_id", this.uid)
      .select(POST_SELECT)
      .maybeSingle();
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
      await this.db.from("comments").select(COMMENT_SELECT).eq("post_id", postId).is("deleted_at", null).order("created_at").limit(200),
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
