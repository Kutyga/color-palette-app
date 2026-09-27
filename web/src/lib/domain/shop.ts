/**
 * Магазины: витрина с ✓ после ручной проверки, каталог с ценами (разбор файла прайса — price-list.ts),
 * «Где купить» на странице вида и уведомления по списку «Хочу». Денег через приложение нет —
 * покупатель уходит на сайт магазина или звонит. На сервере — supabase/migrations/*_shops.sql.
 */

/** Статус заявки: товары видны покупателям только у проверенного магазина. */
export type ShopStatus = "pending" | "verified" | "rejected" | "suspended";
export const SHOP_STATUS: Record<ShopStatus, string> = {
  pending: "На проверке",
  verified: "Проверен",
  rejected: "Отклонён",
  suspended: "Скрыт",
};

export interface Shop {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  /** null — магазин не указал ИНН (пока проверка ИНН отключена, см. INN_REQUIRED). */
  inn: string | null;
  city: string;
  address: string | null;
  hours: string | null;
  phone: string | null;
  website: string | null;
  delivery: boolean;
  status: ShopStatus;
  reviewNote: string | null;
  createdAt: Date;
  verifiedAt: Date | null;
  mine: boolean;
}

export interface ShopDraft {
  name: string;
  description: string;
  inn: string;
  city: string;
  address: string;
  hours: string;
  phone: string;
  website: string;
  delivery: boolean;
}

/** Пустая анкета нового магазина; город подставляется из профиля. */
export const emptyShopDraft = (city = ""): ShopDraft => ({
  name: "",
  description: "",
  inn: "",
  city,
  address: "",
  hours: "",
  phone: "",
  website: "",
  delivery: false,
});

/** Анкета для правки существующего магазина. */
export const shopToDraft = (s: Shop): ShopDraft => ({
  name: s.name,
  description: s.description,
  inn: s.inn ?? "",
  city: s.city,
  address: s.address ?? "",
  hours: s.hours ?? "",
  phone: s.phone ?? "",
  website: s.website ?? "",
  delivery: s.delivery,
});

export interface ShopProduct {
  id: string;
  externalId: string;
  title: string;
  /** id вида из базы знаний (slug) или null — не сопоставлен. */
  speciesId: string | null;
  priceRub: number | null;
  inStock: boolean;
  potCm: number | null;
  heightCm: number | null;
  url: string | null;
  imageUrl: string | null;
}

/** Строка для импорта: то же, что товар, без id. */
export type ProductInput = Omit<ShopProduct, "id">;

export interface ImportResult {
  inserted: number;
  updated: number;
  deleted: number;
}

/** Предложение магазина на странице вида. */
export interface Offer {
  productId: string;
  title: string;
  priceRub: number | null;
  potCm: number | null;
  heightCm: number | null;
  url: string | null;
  imageUrl: string | null;
  shopId: string;
  shopName: string;
  shopCity: string;
  shopDelivery: boolean;
  sameCity: boolean;
}

export const MAX_PRODUCTS = 5000;

// ---------------------------------------------------------------------------
// Проверка анкеты
// ---------------------------------------------------------------------------

/**
 * Проверка ИНН временно отключена: поле необязательное, контрольные цифры не проверяются
 * (указанный ИНН должен быть из 10 или 12 цифр — этого требует база). Вернуть — true.
 */
export const INN_REQUIRED = false;

/** Контрольные цифры ИНН (10 цифр — организация, 12 — ИП). */
export function isValidInn(inn: string): boolean {
  if (!/^\d{10}(\d{2})?$/.test(inn)) return false;
  const d = [...inn].map(Number);
  const check = (weights: number[]) => (weights.reduce((sum, w, i) => sum + w * d[i], 0) % 11) % 10;
  if (d.length === 10) return check([2, 4, 10, 3, 5, 9, 4, 6, 8]) === d[9];
  return check([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === d[10] && check([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === d[11];
}

/** «example.ru» → «https://example.ru»; пустая строка — null. */
export function normalizeWebsite(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

/** Проверка анкеты перед отправкой: первая ошибка с полем, к которому она относится, или null. */
export function validateShop(d: ShopDraft): { field: keyof ShopDraft; message: string } | null {
  const name = d.name.trim();
  if (name.length < 2 || name.length > 80) return { field: "name", message: "Название — от 2 до 80 символов" };
  const inn = d.inn.trim();
  if (INN_REQUIRED ? !isValidInn(inn) : inn !== "" && !/^\d{10}(\d{2})?$/.test(inn))
    return { field: "inn", message: "Проверьте ИНН: 10 цифр у организации, 12 — у ИП" };
  const city = d.city.trim();
  if (city.length < 2 || city.length > 60) return { field: "city", message: "Укажите город" };
  if (d.description.length > 1000) return { field: "description", message: "Описание — до 1000 символов" };
  if (d.address.length > 200) return { field: "address", message: "Адрес — до 200 символов" };
  if (d.hours.length > 100) return { field: "hours", message: "Часы работы — до 100 символов" };
  if (d.phone.trim() && !/^[+\d][\d\s()-]{5,29}$/.test(d.phone.trim()))
    return { field: "phone", message: "Телефон — цифры, пробелы, скобки и дефисы" };
  const site = normalizeWebsite(d.website);
  if (site && (site.length > 300 || !/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(site)))
    return { field: "website", message: "Проверьте адрес сайта" };
  if (!d.phone.trim() && !site && !d.address.trim())
    return { field: "phone", message: "Оставьте хотя бы один способ связи: телефон, сайт или адрес" };
  return null;
}

// ---------------------------------------------------------------------------
// Ссылки
// ---------------------------------------------------------------------------

/** Метки для аналитики магазина: переходы из «Подоконника» видны в его статистике. */
export function withUtm(url: string, campaign: "where_to_buy" | "storefront"): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has("utm_source")) {
      u.searchParams.set("utm_source", "podokonnik");
      u.searchParams.set("utm_medium", "referral");
      u.searchParams.set("utm_campaign", campaign);
    }
    return u.toString();
  } catch {
    return url;
  }
}

/** Ссылка для звонка: только цифры и «+». */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

// ---------------------------------------------------------------------------
// Строки базы
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
const numOrNull = (v: unknown) => (v == null ? null : Number(v));

export function shopFromRow(r: Row, myId: string | null): Shop {
  return {
    id: r.id as string,
    ownerId: r.owner_id as string,
    name: r.name as string,
    description: (r.description as string | null) ?? "",
    inn: (r.inn as string | null) || null,
    city: r.city as string,
    address: (r.address as string | null) || null,
    hours: (r.hours as string | null) || null,
    phone: (r.phone as string | null) || null,
    website: (r.website as string | null) || null,
    delivery: Boolean(r.delivery),
    status: (r.status as ShopStatus) ?? "pending",
    reviewNote: (r.review_note as string | null) || null,
    createdAt: new Date(r.created_at as string),
    verifiedAt: r.verified_at ? new Date(r.verified_at as string) : null,
    mine: myId != null && r.owner_id === myId,
  };
}

export function productFromRow(r: Row): ShopProduct {
  return {
    id: r.id as string,
    externalId: r.external_id as string,
    title: r.title as string,
    speciesId: (r.species_id as string | null) ?? null,
    priceRub: numOrNull(r.price_rub),
    inStock: Boolean(r.in_stock),
    potCm: numOrNull(r.pot_cm),
    heightCm: numOrNull(r.height_cm),
    url: (r.url as string | null) ?? null,
    imageUrl: (r.image_url as string | null) ?? null,
  };
}

export function offerFromRow(r: Row): Offer {
  return {
    productId: r.product_id as string,
    title: r.title as string,
    priceRub: numOrNull(r.price_rub),
    potCm: numOrNull(r.pot_cm),
    heightCm: numOrNull(r.height_cm),
    url: (r.url as string | null) ?? null,
    imageUrl: (r.image_url as string | null) ?? null,
    shopId: r.shop_id as string,
    shopName: r.shop_name as string,
    shopCity: r.shop_city as string,
    shopDelivery: Boolean(r.shop_delivery),
    sameCity: Boolean(r.same_city),
  };
}

/** «Горшок 24 см · 100 см» */
export function sizeLabel(p: Pick<ShopProduct, "potCm" | "heightCm">): string {
  return [p.potCm != null && `горшок ${p.potCm} см`, p.heightCm != null && `высота ${p.heightCm} см`].filter(Boolean).join(" · ");
}
