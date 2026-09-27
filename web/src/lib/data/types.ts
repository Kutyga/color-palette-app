import type { CareEvent, CareTask, CareType, LightLevel } from "../domain/care";
import type { GardenStats } from "../domain/gamification";
import type { Prediction } from "../domain/identification";
import type { Location, NewPlant, Plant, PlantDetails } from "../domain/plant";
import type { PersonCard, ProfileUpdate, PublicPlant } from "../domain/people";
import type { ChatMessage, Conversation, Listing, ListingDraft, ListingFilter, ListingStatus } from "../domain/market";
import type { DiaryScope, FeedPost, HelpFilter, NewPost, PostUpdate, NewsArticle, PostComment, ReaderArticle } from "../domain/social";

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
  /** Переставить растение в другое место (null — место не указано); интервалы пересчитываются. */
  setLocation(plantId: string, locationId: string | null): Promise<void>;
  /** Удалить ошибочную отметку ухода; если она последняя — график возвращается как был. */
  deleteCareEvent(eventId: string): Promise<void>;
  /** Растёт в воде — полив не нужен (график полива выключается и включается обратно). */
  setInWater(plantId: string, inWater: boolean): Promise<void>;
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
  /** Лента «Дневники». */
  diaries(scope: DiaryScope): Promise<FeedPost[]>;
  /** Дневник одного растения — от первой записи к последней. */
  plantDiary(plantId: string): Promise<FeedPost[]>;
  /** Вопросы раздела «Помощь». */
  questions(filter: HelpFilter): Promise<FeedPost[]>;
  post(id: string): Promise<FeedPost | null>;
  /** Автор вопроса отмечает лучший ответ (null — снять отметку). */
  markSolved(postId: string, commentId: string | null): Promise<void>;
  /** langs — языки новостей; пустой список = все. */
  news(onlyMySpecies?: boolean, langs?: string[]): Promise<NewsArticle[]>;
  /** Текст статьи для чтения на сайте; null — недоступно (демо-режим). */
  readArticle(id: string): Promise<ReaderArticle | null>;
  createPost(post: NewPost): Promise<FeedPost>;
  /** Правка своей публикации — только в течение часа после неё. */
  updatePost(id: string, update: PostUpdate): Promise<FeedPost>;
  /** Удаление своей публикации — в любое время. */
  deletePost(id: string): Promise<void>;
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
  city: string | null;
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

/** «Барахолка»: объявления. */
export interface MarketRepository {
  listings(filter: ListingFilter): Promise<Listing[]>;
  listing(id: string): Promise<Listing | null>;
  /** Свои объявления, включая закрытые. */
  myListings(): Promise<Listing[]>;
  createListing(draft: ListingDraft): Promise<Listing>;
  updateListing(id: string, draft: ListingDraft): Promise<Listing>;
  setStatus(id: string, status: ListingStatus): Promise<void>;
  deleteListing(id: string): Promise<void>;
  /** Жалоба модераторам. */
  report(targetType: "listing" | "message" | "profile", targetId: string, reason: string): Promise<void>;
}

/** Личные сообщения по объявлениям. */
export interface ChatRepository {
  conversations(): Promise<Conversation[]>;
  /** Начать чат по объявлению (или открыть уже начатый); возвращает id чата. */
  start(listingId: string): Promise<string>;
  messages(conversationId: string): Promise<ChatMessage[]>;
  send(conversationId: string, body: string): Promise<ChatMessage>;
  markRead(conversationId: string): Promise<void>;
  /** Новые сообщения в чате по мере поступления; возвращает функцию отписки. */
  subscribe(conversationId: string, onMessage: (m: ChatMessage) => void): () => void;
  /** Заблокировать собеседника: писать друг другу больше нельзя. */
  block(userId: string): Promise<void>;
}

/** Настройки уведомлений в профиле. */
export interface NotificationSettings {
  care: boolean;
  messages: boolean;
  community: boolean;
  /** «09:00» — когда присылать напоминание об уходе. */
  reminderTime: string;
  timezone: string;
}

/** Push-уведомления; в демо-режиме их нет. */
export interface NotificationsRepository {
  /** Открытый VAPID-ключ сервера. */
  publicKey(): Promise<string>;
  subscribe(sub: { endpoint: string; p256dh: string; auth: string }, userAgent: string): Promise<void>;
  unsubscribe(endpoint: string): Promise<void>;
  settings(): Promise<NotificationSettings>;
  updateSettings(patch: Partial<NotificationSettings>): Promise<void>;
}

export interface Backend {
  mode: "demo" | "live";
  garden: GardenRepository;
  social: SocialRepository;
  people: PeopleRepository;
  market: MarketRepository;
  chat: ChatRepository;
  notifications: NotificationsRepository | null;
  identifier: PlantIdentifier | null;
  profile(): Promise<Profile>;
}
