/**
 * Магазины в браузере: два проверенных демо-магазина; свою заявку в демо никто
 * не проверяет — она остаётся «на проверке».
 */
import type { ShopStats } from "../../domain/gamification";
import { sameCity } from "../../domain/market";
import {
  MAX_PRODUCTS,
  normalizeWebsite,
  validateShop,
  type ImportResult,
  type Offer,
  type ProductInput,
  type Shop,
  type ShopDraft,
  type ShopStatus,
} from "../../domain/shop";
import type { ShopRepository } from "../repositories";
import { type DemoState, ME, type ShopRec, toDate } from "./state";

export class DemoShops implements ShopRepository {
  constructor(
    private state: DemoState,
    private persist: () => void,
    private clock: () => Date = () => new Date(),
  ) {}

  private get recs() {
    return (this.state.shops ??= []);
  }
  private get catalog() {
    return (this.state.products ??= {});
  }
  private isAdmin() {
    return Boolean(this.state.profile?.isAdmin);
  }
  private toShop(r: ShopRec): Shop {
    return { ...r, createdAt: new Date(r.createdAt), verifiedAt: toDate(r.verifiedAt), mine: r.ownerId === ME };
  }
  private visible(r: ShopRec) {
    return r.ownerId === ME || r.status === "verified" || this.isAdmin();
  }
  private mine() {
    const r = this.recs.find((x) => x.ownerId === ME);
    if (!r) throw new Error("Сначала создайте магазин");
    return r;
  }

  async myShop() {
    const r = this.recs.find((x) => x.ownerId === ME);
    return r ? this.toShop(r) : null;
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
    let r = this.recs.find((x) => x.ownerId === ME);
    if (!r) {
      r = {
        id: crypto.randomUUID(),
        ownerId: ME,
        ...fields,
        status: "pending",
        reviewNote: null,
        createdAt: this.clock().toISOString(),
        verifiedAt: null,
      };
      this.recs.push(r);
    } else {
      // Как триггер shops_guard: новые реквизиты проверенного магазина — снова на проверку.
      if (r.status === "verified" && (r.name !== fields.name || r.inn !== fields.inn)) {
        r.status = "pending";
        r.verifiedAt = null;
      }
      Object.assign(r, fields);
    }
    this.persist();
    return this.toShop(r);
  }

  async shop(id: string) {
    const r = this.recs.find((x) => x.id === id);
    return r && this.visible(r) ? this.toShop(r) : null;
  }

  async shops(city: string | null) {
    const here = (r: ShopRec) => sameCity(r.city, city);
    return this.recs
      .filter((r) => r.status === "verified")
      .sort((a, b) => Number(here(b)) - Number(here(a)) || a.name.localeCompare(b.name))
      .map((r) => this.toShop(r));
  }

  async products(shopId: string) {
    const r = this.recs.find((x) => x.id === shopId);
    if (!r || !this.visible(r)) return [];
    return [...(this.catalog[shopId] ?? [])].sort((a, b) => a.title.localeCompare(b.title));
  }

  async importProducts(rows: ProductInput[], replace: boolean): Promise<ImportResult> {
    const shop = this.mine();
    if (rows.length > MAX_PRODUCTS) throw new Error(`Не больше ${MAX_PRODUCTS} строк за раз`);
    const list = (this.catalog[shop.id] ??= []);
    const byExt = new Map(list.map((p) => [p.externalId, p]));
    const result = { inserted: 0, updated: 0, deleted: 0 };
    for (const row of rows) {
      const cur = byExt.get(row.externalId);
      if (cur) {
        Object.assign(cur, row);
        result.updated++;
      } else {
        if (list.length >= MAX_PRODUCTS) throw new Error(`В каталоге не больше ${MAX_PRODUCTS} товаров`);
        const p = { id: crypto.randomUUID(), ...row };
        list.push(p);
        byExt.set(p.externalId, p);
        result.inserted++;
      }
    }
    if (replace) {
      const keep = new Set(rows.map((r) => r.externalId));
      const before = list.length;
      this.catalog[shop.id] = list.filter((p) => keep.has(p.externalId));
      result.deleted = before - this.catalog[shop.id].length;
    }
    this.persist();
    return result;
  }

  async setInStock(productId: string, inStock: boolean) {
    const p = (this.catalog[this.mine().id] ?? []).find((x) => x.id === productId);
    if (!p) throw new Error("Товар не найден");
    p.inStock = inStock;
    this.persist();
  }

  async deleteProduct(productId: string) {
    const shop = this.mine();
    this.catalog[shop.id] = (this.catalog[shop.id] ?? []).filter((x) => x.id !== productId);
    this.persist();
  }

  async whereToBuy(speciesId: string, city: string | null): Promise<Offer[]> {
    return this.recs
      .filter((s) => s.status === "verified" && (!city || sameCity(s.city, city) || s.delivery))
      .flatMap((s) =>
        (this.catalog[s.id] ?? [])
          .filter((p) => p.inStock && p.speciesId === speciesId)
          .map((p) => ({
            productId: p.id,
            title: p.title,
            priceRub: p.priceRub,
            potCm: p.potCm,
            heightCm: p.heightCm,
            url: p.url,
            imageUrl: p.imageUrl,
            shopId: s.id,
            shopName: s.name,
            shopCity: s.city,
            shopDelivery: s.delivery,
            sameCity: sameCity(s.city, city),
          })),
      )
      .sort((a, b) => Number(b.sameCity) - Number(a.sameCity) || (a.priceRub ?? Infinity) - (b.priceRub ?? Infinity))
      .slice(0, 30);
  }

  async reviewQueue() {
    if (!this.isAdmin()) throw new Error("Только для администратора");
    const order: Record<ShopStatus, number> = { pending: 0, suspended: 1, rejected: 2, verified: 3 };
    return this.recs.map((r) => this.toShop(r)).sort((a, b) => order[a.status] - order[b.status]);
  }

  async myStats(): Promise<ShopStats> {
    const shop = this.recs.find((x) => x.ownerId === ME);
    const products = shop ? (this.catalog[shop.id] ?? []) : [];
    return {
      hasShop: shop ? 1 : 0,
      shopVerified: shop?.status === "verified" ? 1 : 0,
      products: products.length,
      shopSpecies: new Set(products.map((p) => p.speciesId).filter(Boolean)).size,
    };
  }

  async review(shopId: string, status: ShopStatus, note: string) {
    if (!this.isAdmin()) throw new Error("Только для администратора");
    const r = this.recs.find((x) => x.id === shopId);
    if (!r) throw new Error("Магазин не найден");
    r.status = status;
    r.reviewNote = note.trim() || null;
    r.verifiedAt = status === "verified" ? this.clock().toISOString() : null;
    this.persist();
  }
}
