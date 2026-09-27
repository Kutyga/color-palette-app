/**
 * Сообщество в браузере: дневники, вопросы, комментарии и новости-подборки.
 */
import {
  EDIT_WINDOW_MS,
  type DiaryScope,
  type FeedPost,
  type HelpFilter,
  type NewPost,
  type NewsArticle,
  type PostComment,
  type PostUpdate,
} from "../../domain/social";
import { speciesName, type Species } from "../../domain/species";
import { blobToDataUrl } from "../../image";
import { ALL_SPECIES } from "../../knowledge";
import { HOUR_MS } from "../../time";
import type { SocialRepository } from "../repositories";
import { DEFAULT_PROFILE, DEMO_PEOPLE, demoId } from "./fixtures";
import { type CommentRec, type DemoState, ME, type PostRec } from "./state";

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
      editedAt: p.editedAt ? new Date(p.editedAt) : null,
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

  async updatePost(id: string, update: PostUpdate) {
    const p = this.state.posts.find((x) => x.id === id && x.authorId === ME);
    if (!p) throw new Error("Публикация не найдена");
    if (this.clock().getTime() - new Date(p.createdAt).getTime() > EDIT_WINDOW_MS) {
      throw new Error("Прошло больше часа — публикацию уже нельзя изменить");
    }
    p.text = update.text;
    if (update.event !== undefined && (p.kind ?? "diary") === "diary") p.event = update.event;
    p.editedAt = this.clock().toISOString();
    this.persist();
    return this.toPost(p);
  }

  async deletePost(id: string) {
    const p = this.state.posts.find((x) => x.id === id && x.authorId === ME);
    if (!p) return;
    this.state.posts = this.state.posts.filter((x) => x !== p);
    this.state.comments = this.state.comments.filter((c) => c.postId !== id);
    this.persist();
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
    const c: CommentRec = {
      id: crypto.randomUUID(),
      postId,
      authorName: (this.state.profile ?? DEFAULT_PROFILE).username,
      text,
      createdAt: this.clock().toISOString(),
      mine: true,
    };
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
    const questions = new Map(this.state.posts.filter((p) => p.kind === "question").map((p) => [p.id, p]));
    const answers = this.state.comments.filter((c) => c.mine && questions.has(c.postId));
    return {
      posts: mine.length,
      likesReceived: mine.reduce((sum, p) => sum + p.likeCount, 0),
      answers: answers.length,
      bestAnswers: answers.filter((c) => questions.get(c.postId)?.solvedCommentId === c.id).length,
      // В демо-режиме на гостя подписаны демо-садоводы с «подписан на вас».
      followers: DEMO_PEOPLE.filter((d) => d.followsMe).length,
    };
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
        publishedAt: new Date(now - (i + 1) * 5 * HOUR_MS),
        summary: s.descriptionRu,
        imageUrl: null,
        speciesIds: [s.id],
        language: "ru",
      }));
  }
}
