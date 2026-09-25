import type { CareEvent, CareTask, CareType, LightLevel } from "../domain/care";
import type { GardenStats } from "../domain/gamification";
import type { Prediction } from "../domain/identification";
import type { Location, NewPlant, Plant, PlantDetails } from "../domain/plant";
import type { PersonCard, ProfileUpdate, PublicPlant } from "../domain/people";
import type { FeedPost, FeedTab, NewPost, NewsArticle, PostComment, ReaderArticle } from "../domain/social";

/** Черновик растения: вид задаётся slug из базы знаний, настоящий id находит репозиторий. */
export type PlantDraft = Omit<NewPlant, "speciesId"> & { speciesSlug?: string | null };

/**
 * Единая точка доступа к данным сада. Реализации: SupabaseGarden — боевой бэкенд,
 * DemoGarden — в браузере (демо-режим без регистрации и тесты).
 */
export interface GardenRepository {
  myPlants(): Promise<Plant[]>;
  plantDetails(plantId: string): Promise<PlantDetails>;
  addPlant(draft: PlantDraft): Promise<Plant>;
  deletePlant(plantId: string): Promise<void>;
  /** Загружает фото (JPEG) и делает его обложкой растения. */
  setPlantPhoto(plantId: string, jpeg: Blob): Promise<void>;
  myLocations(): Promise<Location[]>;
  addLocation(name: string, light: LightLevel | null): Promise<Location>;
  /** Задачи ухода со сроком до until (включая просроченные). */
  dueTasks(until: Date): Promise<CareTask[]>;
  /** id задаёт клиент — повторная отправка той же отметки не создаёт дубль. */
  logCare(plantId: string, type: CareType, opts?: { id?: string; performedAt?: Date; note?: string }): Promise<void>;
  /** Отметки ухода с момента since — для колец «сделано сегодня». */
  careEventsSince(since: Date): Promise<CareEvent[]>;
  stats(): Promise<GardenStats>;
}

export interface SocialRepository {
  feed(tab: FeedTab): Promise<FeedPost[]>;
  /** langs — языки новостей; пустой список = все. */
  news(onlyMySpecies?: boolean, langs?: string[]): Promise<NewsArticle[]>;
  /** Текст статьи для чтения на сайте; null — недоступно (демо-режим). */
  readArticle(id: string): Promise<ReaderArticle | null>;
  createPost(post: NewPost): Promise<FeedPost>;
  setLiked(postId: string, liked: boolean): Promise<void>;
  setFollowing(authorId: string, follow: boolean): Promise<void>;
  comments(postId: string): Promise<PostComment[]>;
  addComment(postId: string, text: string): Promise<PostComment>;
  deleteComment(commentId: string): Promise<void>;
  /** Для достижений: сколько постов опубликовано и лайков получено. */
  myActivity(): Promise<{ posts: number; likesReceived: number }>;
}

/** Распознаёт растение по фото. */
export interface PlantIdentifier {
  identify(jpeg: Blob): Promise<Prediction[]>;
}

export interface Profile {
  username: string;
  displayName: string | null;
  bio: string | null;
}

/** Садоводы: поиск, профили, подписчики и их растения. Подписка — SocialRepository.setFollowing. */
export interface PeopleRepository {
  /** Пустой запрос — рекомендации (популярные садоводы). */
  search(query: string): Promise<PersonCard[]>;
  byUsername(username: string): Promise<PersonCard | null>;
  followers(userId: string): Promise<PersonCard[]>;
  following(userId: string): Promise<PersonCard[]>;
  /** Растения садовода, которые разрешено видеть текущему пользователю. */
  plantsOf(userId: string): Promise<PublicPlant[]>;
  /** Меняет свой профиль; занятый username — ошибка с понятным текстом. */
  updateProfile(update: ProfileUpdate): Promise<Profile>;
}

export interface Backend {
  mode: "demo" | "live";
  garden: GardenRepository;
  social: SocialRepository;
  people: PeopleRepository;
  identifier: PlantIdentifier | null;
  profile(): Promise<Profile>;
}
