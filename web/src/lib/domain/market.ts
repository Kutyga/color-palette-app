/**
 * «Барахолка»: объявления «Продаю / Отдам даром / Обмен / Ищу» и личные сообщения по ним.
 * Денег через приложение нет — люди договариваются в чате. На сервере — таблицы listings,
 * conversations, messages (supabase/migrations/*_marketplace_chat.sql).
 */
import { prettyUsername } from "./people";

export const LISTING_KINDS = {
  sell: { label: "Продаю", short: "Продаю", emoji: "🏷️" },
  free: { label: "Отдам даром", short: "Даром", emoji: "🎁" },
  swap: { label: "Обмен", short: "Обмен", emoji: "🔄" },
  wanted: { label: "Ищу", short: "Ищу", emoji: "🔎" },
} as const;
export type ListingKind = keyof typeof LISTING_KINDS;
export const isListingKind = (v: unknown): v is ListingKind => typeof v === "string" && v in LISTING_KINDS;

export type ListingStatus = "active" | "reserved" | "closed";
export const LISTING_STATUS: Record<ListingStatus, string> = {
  active: "Актуально",
  reserved: "Забронировано",
  closed: "Закрыто",
};

export interface Listing {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerDisplayName: string;
  kind: ListingKind;
  speciesId: string | null;
  title: string;
  description: string;
  priceRub: number | null;
  swapFor: string | null;
  city: string;
  delivery: boolean;
  photoUrls: string[];
  status: ListingStatus;
  createdAt: Date;
  mine: boolean;
}

export interface ListingDraft {
  kind: ListingKind;
  title: string;
  description: string;
  speciesId: string | null;
  priceRub: number | null;
  swapFor: string;
  city: string;
  delivery: boolean;
  /** Новый снимок с камеры; при правке без нового снимка — прежние фото. */
  photo: Blob | null;
}

export interface ListingFilter {
  kind: ListingKind | "all";
  /** null — все города. */
  city: string | null;
  deliveryOnly: boolean;
}

export interface Conversation {
  id: string;
  listingId: string | null;
  listingTitle: string | null;
  listingKind: ListingKind | null;
  listingStatus: ListingStatus | null;
  listingPhotoUrl: string | null;
  iAmSeller: boolean;
  otherId: string;
  otherName: string;
  otherDisplayName: string;
  lastMessage: string | null;
  lastMessageAt: Date;
  lastFromMe: boolean;
  unread: boolean;
  /** Кто-то из двоих заблокировал другого — писать нельзя. */
  blocked: boolean;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  mine: boolean;
  body: string;
  createdAt: Date;
}

export const MAX_MESSAGE = 2000;

/** «1 500 ₽», «Даром», «Обмен», «Ищу». */
export function priceLabel(l: Pick<Listing, "kind" | "priceRub">): string {
  if (l.kind === "sell" && l.priceRub != null) return `${l.priceRub.toLocaleString("ru-RU")} ₽`;
  return LISTING_KINDS[l.kind].short;
}

/** Проверка формы объявления; null — всё в порядке. */
export function validateListing(
  d: Omit<ListingDraft, "photo">,
  hasPhoto: boolean,
): { field: keyof ListingDraft; message: string } | null {
  const title = d.title.trim();
  if (title.length < 3) return { field: "title", message: "Название — хотя бы 3 символа" };
  if (title.length > 80) return { field: "title", message: "Название — до 80 символов" };
  if (d.kind === "sell" && !(d.priceRub != null && Number.isInteger(d.priceRub) && d.priceRub >= 1 && d.priceRub <= 1_000_000))
    return { field: "priceRub", message: "Укажите цену от 1 до 1 000 000 ₽" };
  if (d.kind !== "wanted" && !hasPhoto) return { field: "photo", message: "Сфотографируйте растение" };
  const city = d.city.trim();
  if (city.length < 2 || city.length > 60) return { field: "city", message: "Укажите город" };
  if (d.description.length > 2000) return { field: "description", message: "Описание — до 2000 символов" };
  if (d.swapFor.length > 200) return { field: "swapFor", message: "До 200 символов" };
  return null;
}

/** Одинаковые города пишут по-разному: «казань », «Казань». */
export const sameCity = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.trim().toLowerCase().replace(/ё/g, "е") === b.trim().toLowerCase().replace(/ё/g, "е");

type Row = Record<string, unknown>;

/** Ожидает выборку `*, seller:profiles(username, display_name)`. */
export function listingFromRow(r: Row, photoUrls: string[], myId: string | null): Listing {
  const seller = r.seller as { username?: string; display_name?: string | null } | null;
  const username = seller?.username ?? "sadovod";
  return {
    id: r.id as string,
    sellerId: r.seller_id as string,
    sellerName: username,
    sellerDisplayName: seller?.display_name?.trim() || prettyUsername(username),
    kind: isListingKind(r.kind) ? r.kind : "sell",
    speciesId: (r.species_id as string | null) ?? null,
    title: r.title as string,
    description: (r.description as string | null) ?? "",
    priceRub: (r.price_rub as number | null) ?? null,
    swapFor: (r.swap_for as string | null) || null,
    city: r.city as string,
    delivery: Boolean(r.delivery),
    photoUrls,
    status: (r.status as ListingStatus) ?? "active",
    createdAt: new Date(r.created_at as string),
    mine: myId != null && r.seller_id === myId,
  };
}

export function conversationFromRow(r: Row, photoUrl: string | null): Conversation {
  return {
    id: r.id as string,
    listingId: (r.listing_id as string | null) ?? null,
    listingTitle: (r.listing_title as string | null) ?? null,
    listingKind: isListingKind(r.listing_kind) ? r.listing_kind : null,
    listingStatus: (r.listing_status as ListingStatus | null) ?? null,
    listingPhotoUrl: photoUrl,
    iAmSeller: Boolean(r.i_am_seller),
    otherId: r.other_id as string,
    otherName: r.other_username as string,
    otherDisplayName: prettyUsername(r.other_display_name as string),
    lastMessage: (r.last_message as string | null) ?? null,
    lastMessageAt: new Date(r.last_message_at as string),
    lastFromMe: Boolean(r.last_from_me),
    unread: Boolean(r.unread),
    blocked: Boolean(r.blocked),
  };
}

export function messageFromRow(r: Row, myId: string | null): ChatMessage {
  return {
    id: r.id as string,
    conversationId: r.conversation_id as string,
    mine: myId != null && r.sender_id === myId,
    body: r.body as string,
    createdAt: new Date(r.created_at as string),
  };
}
