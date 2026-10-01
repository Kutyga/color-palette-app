/**
 * Состояние демо-режима: записи в том виде, в каком они лежат в localStorage,
 * и хранилища (localStorage в браузере, память — в тестах).
 */
import type { CareEvent, CareSchedule, PotMaterial } from "../../domain/care";
import type { Contest } from "../../domain/contest";
import type { ListingKind, ListingStatus } from "../../domain/market";
import type { Location, Visibility } from "../../domain/plant";
import type { Shop, ShopProduct } from "../../domain/shop";
import type { FeedPost, PostComment } from "../../domain/social";
import type { Profile } from "../repositories";

export interface PlantRec {
  id: string;
  nickname: string;
  speciesSlug: string | null;
  locationId: string | null;
  potMaterial: PotMaterial | null;
  visibility: Visibility;
  notes: string | null;
  createdAt: string;
  inWater?: boolean;
  wick?: boolean;
}

export type Dated<T, K extends keyof T> = Omit<T, K> & { [P in K]: string | null };

export type ScheduleRec = Dated<CareSchedule, "lastDoneAt" | "nextDueAt">;

// prevDoneAt / prevFactor — каким был график до отметки (для отмены, как в базе).
export type EventRec = Omit<CareEvent, "performedAt"> & { performedAt: string; prevDoneAt?: string | null; prevFactor?: number };

// Поля дневника и вопросов необязательны: в сохранённых раньше демо-данных их нет.
export type PostRec = Omit<
  FeedPost,
  | "createdAt"
  | "mine"
  | "following"
  | "authorDisplayName"
  | "authorIsTeam"
  | "kind"
  | "event"
  | "speciesId"
  | "solvedCommentId"
  | "editedAt"
> &
  Partial<Pick<FeedPost, "kind" | "event" | "speciesId" | "solvedCommentId">> & {
    createdAt: string;
    authorDisplayName?: string;
    editedAt?: string | null;
  };

export type CommentRec = Omit<PostComment, "createdAt" | "authorDisplayName"> & { createdAt: string; authorDisplayName?: string };

export interface DemoState {
  version: 1;
  plants: PlantRec[];
  locations: Location[];
  schedules: ScheduleRec[];
  events: EventRec[];
  /** Фото растений — data URL, пока пользователь не зарегистрировался. */
  photos: Record<string, string>;
  posts: PostRec[];
  comments: CommentRec[];
  /** id авторов, на которых подписан пользователь. */
  following: string[];
  /** Свой профиль в демо-режиме (по умолчанию — «Гость»). */
  profile?: Profile;
  /** «Барахолка» и переписка; в старых сохранённых демо-данных их нет. */
  listings?: ListingRec[];
  contests?: ContestRec[];
  conversations?: ConversationRec[];
  messages?: MessageRec[];
  blocked?: string[];
  /** Магазины и их каталоги, список «Хочу». */
  shops?: ShopRec[];
  products?: Record<string, ShopProduct[]>;
  wishlist?: string[];
}

export type ShopRec = Omit<Shop, "createdAt" | "verifiedAt" | "mine"> & { createdAt: string; verifiedAt: string | null };

export interface ListingRec {
  id: string;
  sellerId: string;
  kind: ListingKind;
  speciesSlug: string | null;
  title: string;
  description: string;
  priceRub: number | null;
  swapFor: string | null;
  city: string;
  delivery: boolean;
  photoUrl: string | null;
  status: ListingStatus;
  createdAt: string;
  deleted?: boolean;
}

export interface ContestEntryRec {
  userId: string;
  createdAt: string;
  place: number | null;
  rank?: number | null;
  claimDeadline?: string | null;
  claimedAt?: string | null;
  deliveredAt?: string | null;
  forfeitedAt?: string | null;
}

/** Секрет лежит рядом, но наружу отдаётся только после итогов — как в базе. */
export type ContestRec = Omit<
  Contest,
  "endsAt" | "createdAt" | "participants" | "joined" | "mine" | "organizerName" | "organizerDisplayName"
> & {
  endsAt: string;
  createdAt: string;
  secret: string;
  entries: ContestEntryRec[];
};

export interface ConversationRec {
  id: string;
  listingId: string | null;
  /** Чат победителя розыгрыша с организатором. */
  contestId?: string;
  /** Личный чат из профиля садовода. */
  direct?: boolean;
  otherId: string;
  iAmSeller: boolean;
  readAt: string | null;
}

export interface MessageRec {
  id: string;
  conversationId: string;
  fromMe: boolean;
  body: string;
  createdAt: string;
}

export const ME = "me";

/** Даты в состоянии хранятся строками ISO — так оно переживает JSON. */
export const iso = (d: Date | null) => (d ? d.toISOString() : null);

export const toDate = (s: string | null) => (s ? new Date(s) : null);

/** Где хранить состояние: localStorage в браузере, память — в тестах. */
export interface DemoStorage {
  load(): DemoState | null;
  save(state: DemoState): void;
}

/** Состояние демо в localStorage браузера; повреждённое или недоступное — как пустое. */
export const localDemoStorage = (key = "moi-sad-demo"): DemoStorage => ({
  load() {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as DemoState) : null;
    } catch {
      return null;
    }
  },
  save(state) {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Переполнение хранилища (много фото) — данные останутся до перезагрузки страницы.
    }
  },
});

/** Состояние в памяти — для тестов. */
export const memoryDemoStorage = (): DemoStorage => {
  let saved: DemoState | null = null;
  return { load: () => saved, save: (s) => void (saved = structuredClone(s)) };
};

/** Состояние до первого запуска: пусто, данные примера добавляет seed. */
export const emptyState = (): DemoState => ({
  version: 1,
  plants: [],
  locations: [],
  schedules: [],
  events: [],
  photos: {},
  posts: [],
  comments: [],
  following: ["demo-anna.green", "demo-orchid.mood"],
});
