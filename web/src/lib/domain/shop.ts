/**
 * Магазины: витрина с ✓ после ручной проверки, каталог с ценами (импорт из CSV/Excel и экспорт),
 * «Где купить» на странице вида и уведомления по списку «Хочу». Денег через приложение нет —
 * покупатель уходит на сайт магазина или звонит. На сервере — supabase/migrations/*_shops.sql.
 */
import type { Species } from "./species";

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

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** Разделитель по первой строке: Excel в России сохраняет CSV через «;». */
function detectDelimiter(text: string): string {
  const nl = text.search(/\r?\n/);
  const firstLine = nl < 0 ? text : text.slice(0, nl);
  let best = ",";
  let bestCount = 0;
  for (const d of [";", ",", "\t"]) {
    let count = 0;
    let quoted = false;
    for (const ch of firstLine) {
      if (ch === '"') quoted = !quoted;
      else if (ch === d && !quoted) count++;
    }
    if (count > bestCount) [best, bestCount] = [d, count];
  }
  return best;
}

/** Разбор CSV с кавычками и переносами внутри ячеек. Пустые строки пропускаются. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const delim = detectDelimiter(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

const csvCell = (v: string | number | null) => {
  const s = v == null ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV для Excel: «;», BOM — чтобы кириллица открылась без «кракозябр». */
function toCsv(rows: (string | number | null)[][]): string {
  return "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// Колонки файла
// ---------------------------------------------------------------------------

export const IMPORT_FIELDS = {
  externalId: { label: "Артикул", hint: "по нему обновляются цены при следующей загрузке" },
  title: { label: "Название", hint: "обязательно" },
  species: { label: "Вид (латынь)", hint: "если нет — ищем вид по названию" },
  priceRub: { label: "Цена, ₽", hint: "" },
  inStock: { label: "В наличии", hint: "да/нет или остаток" },
  potCm: { label: "Горшок, см", hint: "" },
  heightCm: { label: "Высота, см", hint: "" },
  url: { label: "Ссылка", hint: "страница товара на сайте" },
  imageUrl: { label: "Фото", hint: "ссылка https://" },
} as const;
export type ImportField = keyof typeof IMPORT_FIELDS;
/** Номер колонки файла для каждого поля; null — такой колонки нет. */
export type ColumnMapping = Record<ImportField, number | null>;

const HEADER_PATTERNS: Record<ImportField, RegExp> = {
  externalId: /^(артикул|арт\.?|sku|код|код товара|id|external_id|vendor ?code)$/,
  title: /^(название|наименование|товар|наименование товара|title|name|product)$/,
  species: /^(вид|вид \(латынь\)|латинское название|латынь|latin|species|botanical name)$/,
  priceRub: /^(цена|цена, ?₽|цена, ?руб\.?|стоимость|розничная цена|price|price_rub)$/,
  inStock: /^(в наличии|наличие|остаток|остатки|количество|кол-во|stock|in_stock|qty|quantity)$/,
  potCm: /^(горшок|горшок, ?см|диаметр горшка|диаметр|pot|pot_cm|pot size)$/,
  heightCm: /^(высота|высота, ?см|height|height_cm)$/,
  url: /^(ссылка|url|ссылка на товар|link|product url)$/,
  imageUrl: /^(фото|картинка|изображение|image|image_url|photo|picture)$/,
};

/** Угадываем колонки по заголовкам — магазину остаётся поправить несовпавшие. */
export function guessMapping(headers: string[]): ColumnMapping {
  const norm = headers.map((h) => h.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " "));
  const mapping = {} as ColumnMapping;
  for (const field of Object.keys(HEADER_PATTERNS) as ImportField[]) {
    const i = norm.findIndex((h) => HEADER_PATTERNS[field].test(h));
    mapping[field] = i >= 0 ? i : null;
  }
  return mapping;
}

/** «1 290,50 ₽» → 1290.5; не число — null. */
export function parseNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.replace(/[\s ₽]|руб\.?|р\.?$/gi, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

/** «да», «есть», «+», число больше нуля — в наличии; пустая ячейка тоже (раз товар в прайсе). */
export function parseInStock(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v > 0;
  const s = String(v).trim().toLowerCase();
  if (!s) return true;
  const n = parseNumber(s);
  if (n != null) return n > 0;
  return !/^(нет|no|false|-|—|отсутствует|нет в наличии|под заказ|закончился|0)$/.test(s);
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();

interface NameIndex {
  species: Species;
  name: string;
  latin: boolean;
}

/** Индекс названий для сопоставления — строится один раз на весь файл. */
export function speciesMatcher(all: Species[]) {
  const names: NameIndex[] = all.flatMap((s) => [
    ...[s.latinName, ...s.synonyms].map((n) => ({ species: s, name: norm(n), latin: true })),
    ...s.commonNamesRu.map((n) => ({ species: s, name: norm(n), latin: false })),
  ]);
  // Сначала длинные названия: «монстера деликатесная» точнее, чем «монстера».
  names.sort((a, b) => b.name.length - a.name.length);
  const bounded = (text: string, name: string) => {
    let from = 0;
    for (;;) {
      const i = text.indexOf(name, from);
      if (i < 0) return false;
      const before = text[i - 1];
      const after = text[i + name.length];
      if ((!before || !/[\p{L}\d]/u.test(before)) && (!after || !/[\p{L}\d]/u.test(after))) return true;
      from = i + 1;
    }
  };
  /** Вид по названию товара или колонке «Вид»: латынь надёжнее, потом русские названия. */
  return (text: string): Species | null => {
    const t = norm(text);
    if (!t) return null;
    const latin = names.find((n) => n.latin && n.name.length >= 4 && bounded(t, n.name));
    if (latin) return latin.species;
    return names.find((n) => !n.latin && n.name.length >= 3 && bounded(t, n.name))?.species ?? null;
  };
}

/** «Монстера деликатесная 24/100» → «monstera-delikatesnaya-24-100» — если в файле нет артикула. */
export function slugifyTitle(title: string): string {
  const map: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };
  return [...title.toLowerCase()]
    .map((c) => map[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

export interface ParsedRow extends ProductInput {
  /** Номер строки в файле (с 2 — после заголовка). */
  line: number;
  /** Причина, по которой строка не будет загружена. */
  error: string | null;
}

const cellText = (v: unknown) => (v == null ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v)).trim();
const httpUrl = (v: string, httpsOnly = false) =>
  v && (httpsOnly ? /^https:\/\//i : /^https?:\/\//i).test(v) && v.length <= 500 ? v : null;
const positive = (n: number | null, max: number) => (n != null && n > 0 && n < max ? n : null);

/** Строки файла → товары для импорта; ошибочные помечены и не загружаются. */
export function rowsToProducts(rows: unknown[][], mapping: ColumnMapping, match: (text: string) => Species | null): ParsedRow[] {
  const at = (row: unknown[], f: ImportField) => (mapping[f] == null ? null : row[mapping[f]!]);
  const seen = new Set<string>();
  return rows.map((row, i) => {
    const title = cellText(at(row, "title")).slice(0, 200);
    const externalId = (cellText(at(row, "externalId")) || slugifyTitle(title)).slice(0, 100);
    const speciesText = cellText(at(row, "species"));
    const species = (speciesText && match(speciesText)) || match(title);
    const price = parseNumber(at(row, "priceRub"));
    const priceRub = price == null ? null : Math.round(price);
    let error: string | null = null;
    if (!title) error = "Нет названия";
    else if (!externalId) error = "Нет артикула";
    else if (priceRub != null && (priceRub < 1 || priceRub > 10_000_000)) error = "Цена вне диапазона";
    else if (seen.has(externalId)) error = "Артикул повторяется";
    if (!error) seen.add(externalId);
    const pot = positive(parseNumber(at(row, "potCm")), 1000);
    const height = positive(parseNumber(at(row, "heightCm")), 10000);
    return {
      line: i + 2,
      error,
      externalId,
      title,
      speciesId: species?.id ?? null,
      priceRub,
      inStock: mapping.inStock == null ? true : parseInStock(at(row, "inStock")),
      potCm: pot == null ? null : Math.round(pot * 10) / 10,
      heightCm: height == null ? null : Math.round(height),
      url: httpUrl(cellText(at(row, "url"))),
      imageUrl: httpUrl(cellText(at(row, "imageUrl")), true),
    };
  });
}

const EXPORT_HEADER = ["Артикул", "Название", "Вид (латынь)", "Цена, ₽", "В наличии", "Горшок, см", "Высота, см", "Ссылка", "Фото"];

/** Выгрузка каталога — тот же формат, что и загрузка, чтобы править в Excel и загружать обратно. */
export function productsToCsv(products: ShopProduct[], latinOf: (speciesId: string | null) => string | null): string {
  return toCsv([
    EXPORT_HEADER,
    ...products.map((p) => [
      p.externalId,
      p.title,
      latinOf(p.speciesId) ?? "",
      p.priceRub,
      p.inStock ? "да" : "нет",
      p.potCm,
      p.heightCm,
      p.url ?? "",
      p.imageUrl ?? "",
    ]),
  ]);
}

/** Шаблон для первой загрузки. */
export const TEMPLATE_CSV = toCsv([
  EXPORT_HEADER,
  ["MON-24", "Монстера деликатесная 24/100", "Monstera deliciosa", 3490, "да", 24, 100, "https://example.ru/monstera-24", ""],
  ["ZAM-17", "Замиокулькас 17/60", "", 1890, 5, 17, 60, "", ""],
  ["CAL-14", "Калатея орбифолия", "", 2290, "нет", 14, 45, "", ""],
]);

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
