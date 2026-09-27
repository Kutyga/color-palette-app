import type { CareEvent, CareTask, CareType, LightLevel } from "../domain/care";
import type { ActivityStats, GardenStats, MarketStats, ShopStats } from "../domain/gamification";
import type { Prediction } from "../domain/identification";
import type { Location, NewPlant, Plant, PlantDetails } from "../domain/plant";
import type { PersonCard, ProfileUpdate, PublicPlant } from "../domain/people";
import type { ChatMessage, Conversation, Listing, ListingDraft, ListingFilter, ListingStatus } from "../domain/market";
import type { ImportResult, Offer, ProductInput, Shop, ShopDraft, ShopProduct, ShopStatus } from "../domain/shop";
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
  /** Для достижений: публикации, «Поддержать», ответы в «Помощи» (и лучшие), подписчики. */
  myActivity(): Promise<ActivityStats>;
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
  /** Администратор проверяет заявки магазинов. */
  isAdmin: boolean;
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
  /** Для достижений: свои объявления (включая удалённые), «Отдам даром», закрытые сделки. */
  myStats(): Promise<MarketStats>;
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
  /** «Появилось в продаже / подешевело» по списку «Хочу». */
  wishlist: boolean;
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

/** Магазины: своя витрина и каталог, «Где купить», проверка заявок администратором. */
export interface ShopRepository {
  myShop(): Promise<Shop | null>;
  /** Создаёт заявку или меняет анкету; смена названия или ИНН проверенного магазина — снова на проверку. */
  saveShop(draft: ShopDraft): Promise<Shop>;
  shop(id: string): Promise<Shop | null>;
  /** Проверенные магазины; city — сначала свой город. */
  shops(city: string | null): Promise<Shop[]>;
  products(shopId: string): Promise<ShopProduct[]>;
  /** Загрузка каталога: обновление по артикулу; replace — удалить товары, которых нет в файле. */
  importProducts(rows: ProductInput[], replace: boolean): Promise<ImportResult>;
  setInStock(productId: string, inStock: boolean): Promise<void>;
  deleteProduct(productId: string): Promise<void>;
  /** Предложения проверенных магазинов по виду: свой город и с доставкой. */
  whereToBuy(speciesId: string, city: string | null): Promise<Offer[]>;
  /** Для администратора: все магазины, заявки первыми. */
  reviewQueue(): Promise<Shop[]>;
  review(shopId: string, status: ShopStatus, note: string): Promise<void>;
  /** Для достижений магазина. */
  myStats(): Promise<ShopStats>;
}

/** Список «Хочу»: виды, которые садовод хочет купить. */
export interface WishlistRepository {
  /** id видов из базы знаний. */
  list(): Promise<string[]>;
  set(speciesId: string, wanted: boolean): Promise<void>;
}

export interface Backend {
  mode: "demo" | "live";
  garden: GardenRepository;
  social: SocialRepository;
  people: PeopleRepository;
  market: MarketRepository;
  chat: ChatRepository;
  shops: ShopRepository;
  wishlist: WishlistRepository;
  notifications: NotificationsRepository | null;
  identifier: PlantIdentifier | null;
  profile(): Promise<Profile>;
}
