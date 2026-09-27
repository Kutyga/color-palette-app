/**
 * Магазины в Supabase: анкета, каталог, импорт прайса, «Где купить» и проверка заявок.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MAX_PRODUCTS,
  normalizeWebsite,
  offerFromRow,
  productFromRow,
  shopFromRow,
  validateShop,
  type ProductInput,
  type ShopDraft,
  type ShopStatus,
} from "../../domain/shop";
import type { ShopRepository } from "../repositories";
import { type Row, type SpeciesIds, check } from "./shared";

const SHOP_FIELDS =
  "id, owner_id, name, description, inn, city, address, hours, phone, website, delivery, status, review_note, created_at, verified_at";

const PRODUCT_FIELDS = "id, external_id, title, species_id, price_rub, in_stock, pot_cm, height_cm, url, image_url";

const IMPORT_CHUNK = 1000;

export class SupabaseShops implements ShopRepository {
  constructor(
    private db: SupabaseClient,
    private uid: string,
    private species: SpeciesIds,
  ) {}

  async myShop() {
    const row = check(await this.db.from("shops").select(SHOP_FIELDS).eq("owner_id", this.uid).maybeSingle()) as Row | null;
    return row ? shopFromRow(row, this.uid) : null;
  }

  async saveShop(d: ShopDraft) {
    const invalid = validateShop(d);
    if (invalid) throw new Error(invalid.message);
    const fields = {
      name: d.name.trim(),
      description: d.description.trim(),
      inn: d.inn.trim() || null,
      city: d.city.trim(),
      address: d.address.trim() || null,
      hours: d.hours.trim() || null,
      phone: d.phone.trim() || null,
      website: normalizeWebsite(d.website),
      delivery: d.delivery,
    };
    const existing = await this.myShop();
    const res = existing
      ? await this.db.from("shops").update(fields).eq("id", existing.id).select(SHOP_FIELDS).single()
      : await this.db.from("shops").insert(fields).select(SHOP_FIELDS).single();
    if (res.error?.code === "23505") throw new Error("У вас уже есть магазин");
    return shopFromRow(check(res) as Row, this.uid);
  }

  async shop(id: string) {
    const row = check(await this.db.from("shops").select(SHOP_FIELDS).eq("id", id).maybeSingle()) as Row | null;
    return row ? shopFromRow(row, this.uid) : null;
  }

  async shops(city: string | null) {
    const rows = check(await this.db.from("shops").select(SHOP_FIELDS).eq("status", "verified").order("name").limit(200)) as Row[];
    const list = rows.map((r) => shopFromRow(r, this.uid));
    const here = (s: { city: string }) => !!city && s.city.trim().toLowerCase() === city.trim().toLowerCase();
    return list.sort((a, b) => Number(here(b)) - Number(here(a)));
  }

  async products(shopId: string) {
    const [rows, slugOf] = await Promise.all([
      this.db.from("shop_products").select(PRODUCT_FIELDS).eq("shop_id", shopId).order("title").limit(MAX_PRODUCTS),
      this.species.slugs(),
    ]);
    return (check(rows) as Row[]).map((r) => ({ ...productFromRow(r), speciesId: slugOf(r.species_id as string | null) }));
  }

  async importProducts(rows: ProductInput[], replace: boolean) {
    const uuidOf = await this.species.uuids();
    const payload = rows.map((p) => ({
      external_id: p.externalId,
      title: p.title,
      species_id: uuidOf(p.speciesId),
      price_rub: p.priceRub,
      in_stock: p.inStock,
      pot_cm: p.potCm,
      height_cm: p.heightCm,
      url: p.url,
      image_url: p.imageUrl,
    }));
    // Один вызов — одна транзакция; при замене каталога файл обязан уйти целиком.
    if (replace || payload.length <= IMPORT_CHUNK) {
      const r = (check(await this.db.rpc("shop_import_products", { p_rows: payload, p_replace: replace })) as Row[])[0] ?? {};
      return { inserted: Number(r.inserted ?? 0), updated: Number(r.updated ?? 0), deleted: Number(r.deleted ?? 0) };
    }
    const total = { inserted: 0, updated: 0, deleted: 0 };
    for (let i = 0; i < payload.length; i += IMPORT_CHUNK) {
      const r =
        (check(await this.db.rpc("shop_import_products", { p_rows: payload.slice(i, i + IMPORT_CHUNK), p_replace: false })) as Row[])[0] ??
        {};
      total.inserted += Number(r.inserted ?? 0);
      total.updated += Number(r.updated ?? 0);
    }
    return total;
  }

  async setInStock(productId: string, inStock: boolean) {
    check(await this.db.from("shop_products").update({ in_stock: inStock }).eq("id", productId));
  }

  async deleteProduct(productId: string) {
    check(await this.db.from("shop_products").delete().eq("id", productId));
  }

  async whereToBuy(speciesId: string, city: string | null) {
    const uuid = (await this.species.uuids())(speciesId);
    if (!uuid) return [];
    const rows = check(await this.db.rpc("where_to_buy", { p_species: uuid, p_city: city?.trim() || null })) as Row[];
    return rows.map(offerFromRow);
  }

  async reviewQueue() {
    const rows = check(await this.db.from("shops").select(SHOP_FIELDS).order("created_at", { ascending: false }).limit(200)) as Row[];
    const order: Record<ShopStatus, number> = { pending: 0, suspended: 1, rejected: 2, verified: 3 };
    return rows.map((r) => shopFromRow(r, this.uid)).sort((a, b) => order[a.status] - order[b.status]);
  }

  async myStats() {
    const shop = await this.myShop();
    if (!shop) return { hasShop: 0, shopVerified: 0, products: 0, shopSpecies: 0 };
    const rows = check(await this.db.from("shop_products").select("species_id").eq("shop_id", shop.id).limit(MAX_PRODUCTS)) as Row[];
    return {
      hasShop: 1,
      shopVerified: shop.status === "verified" ? 1 : 0,
      products: rows.length,
      shopSpecies: new Set(rows.map((r) => r.species_id).filter(Boolean)).size,
    };
  }

  async review(shopId: string, status: ShopStatus, note: string) {
    check(await this.db.rpc("review_shop", { p_shop: shopId, p_status: status, p_note: note.trim() || null }));
  }
}
