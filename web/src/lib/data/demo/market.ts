/**
 * «Барахолка» в браузере.
 */
import { sameCity, validateListing, type Listing, type ListingDraft, type ListingFilter, type ListingStatus } from "../../domain/market";
import { blobToDataUrl } from "../../image";
import { ALL_SPECIES } from "../../knowledge";
import type { MarketRepository } from "../repositories";
import { DEFAULT_PROFILE, personOf } from "./fixtures";
import { type DemoState, type ListingRec, ME } from "./state";

export class DemoMarket implements MarketRepository {
  constructor(
    private state: DemoState,
    private persist: () => void,
    private clock: () => Date = () => new Date(),
  ) {}

  private get recs() {
    return (this.state.listings ??= []);
  }

  private toListing(r: ListingRec): Listing {
    const person = personOf(r.sellerId);
    const me = this.state.profile ?? DEFAULT_PROFILE;
    const sp = ALL_SPECIES.find((x) => x.slug === r.speciesSlug) ?? null;
    return {
      id: r.id,
      sellerId: r.sellerId,
      sellerName: r.sellerId === ME ? me.username : (person?.username ?? "sadovod"),
      sellerDisplayName: r.sellerId === ME ? (me.displayName ?? "Вы") : (person?.displayName ?? "Садовод"),
      kind: r.kind,
      speciesId: sp?.id ?? null,
      title: r.title,
      description: r.description,
      priceRub: r.priceRub,
      swapFor: r.swapFor,
      city: r.city,
      delivery: r.delivery,
      photoUrls: r.photoUrl ? [r.photoUrl] : [],
      status: r.status,
      createdAt: new Date(r.createdAt),
      mine: r.sellerId === ME,
    };
  }

  private sorted(list: ListingRec[]) {
    return list.map((r) => this.toListing(r)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async listings(f: ListingFilter) {
    const blocked = this.state.blocked ?? [];
    return this.sorted(
      this.recs.filter(
        (r) =>
          !r.deleted &&
          r.status !== "closed" &&
          !blocked.includes(r.sellerId) &&
          (f.kind === "all" || r.kind === f.kind) &&
          (!f.city || sameCity(r.city, f.city)) &&
          (!f.deliveryOnly || r.delivery),
      ),
    );
  }

  async listing(id: string) {
    const r = this.recs.find((x) => x.id === id && !x.deleted);
    return r ? this.toListing(r) : null;
  }

  async myListings() {
    return this.sorted(this.recs.filter((r) => r.sellerId === ME && !r.deleted));
  }

  private async apply(r: ListingRec, d: ListingDraft) {
    const invalid = validateListing(d, !!d.photo || !!r.photoUrl);
    if (invalid) throw new Error(invalid.message);
    r.kind = d.kind;
    r.title = d.title.trim();
    r.description = d.description.trim();
    r.speciesSlug = ALL_SPECIES.find((x) => x.id === d.speciesId)?.slug ?? null;
    r.priceRub = d.kind === "sell" ? d.priceRub : null;
    r.swapFor = d.kind === "swap" ? d.swapFor.trim() || null : null;
    r.city = d.city.trim();
    r.delivery = d.delivery;
    if (d.photo) r.photoUrl = await blobToDataUrl(d.photo);
  }

  async createListing(d: ListingDraft) {
    if (this.recs.filter((r) => r.sellerId === ME && !r.deleted && r.status !== "closed").length >= 20) {
      throw new Error("Не больше 20 открытых объявлений — закройте проданные");
    }
    const r: ListingRec = {
      id: crypto.randomUUID(),
      sellerId: ME,
      kind: d.kind,
      speciesSlug: null,
      title: "",
      description: "",
      priceRub: null,
      swapFor: null,
      city: "",
      delivery: false,
      photoUrl: null,
      status: "active",
      createdAt: this.clock().toISOString(),
    };
    await this.apply(r, d);
    this.recs.push(r);
    this.persist();
    return this.toListing(r);
  }

  async updateListing(id: string, d: ListingDraft) {
    const r = this.recs.find((x) => x.id === id && x.sellerId === ME);
    if (!r) throw new Error("Объявление не найдено");
    await this.apply(r, d);
    this.persist();
    return this.toListing(r);
  }

  async setStatus(id: string, status: ListingStatus) {
    const r = this.recs.find((x) => x.id === id && x.sellerId === ME);
    if (r) r.status = status;
    this.persist();
  }

  async deleteListing(id: string) {
    const r = this.recs.find((x) => x.id === id && x.sellerId === ME);
    if (r) r.deleted = true;
    this.persist();
  }

  /** Удалённые объявления тоже считаются: награды за прошлые сделки не пропадают. */
  async myStats() {
    const mine = this.recs.filter((r) => r.sellerId === ME);
    return {
      listings: mine.length,
      giveaways: mine.filter((r) => r.kind === "free").length,
      deals: mine.filter((r) => r.status === "closed").length,
    };
  }

  async report() {}
}
