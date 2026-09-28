/**
 * «Барахолка» в Supabase: объявления с фото и жалобы.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { listingFromRow, validateListing, type ListingDraft, type ListingFilter, type ListingStatus } from "../../domain/market";
import type { MarketRepository } from "../repositories";
import { LISTING_BUCKET, type Row, type SpeciesIds, check, signedUrls, uploadJpeg } from "./shared";

const LISTING_SELECT = "*, seller:profiles!listings_seller_id_fkey(username, display_name)";

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export class SupabaseMarket implements MarketRepository {
  constructor(
    private db: SupabaseClient,
    private uid: string,
    private species: SpeciesIds,
  ) {}

  private async hydrate(rows: Row[]) {
    const paths = rows.flatMap((r) => (r.photo_paths as string[] | null) ?? []);
    const [urls, slugOf] = await Promise.all([signedUrls(this.db, LISTING_BUCKET, paths), this.species.slugs()]);
    return rows.map((r) => ({
      ...listingFromRow(
        r,
        ((r.photo_paths as string[] | null) ?? []).map((p) => urls.get(p)).filter((u): u is string => !!u),
        this.uid,
      ),
      speciesId: slugOf(r.species_id as string | null),
    }));
  }

  async listings(filter: ListingFilter) {
    let q = this.db.from("listings").select(LISTING_SELECT).is("deleted_at", null).neq("status", "closed");
    if (filter.kind !== "all") q = q.eq("kind", filter.kind);
    if (filter.city) q = q.ilike("city", escapeLike(filter.city.trim()));
    if (filter.deliveryOnly) q = q.eq("delivery", true);
    return this.hydrate(check(await q.order("created_at", { ascending: false }).limit(60)) as Row[]);
  }

  async listing(id: string) {
    const row = check(
      await this.db.from("listings").select(LISTING_SELECT).eq("id", id).is("deleted_at", null).maybeSingle(),
    ) as Row | null;
    return row ? (await this.hydrate([row]))[0] : null;
  }

  async myListings() {
    const rows = check(
      await this.db
        .from("listings")
        .select(LISTING_SELECT)
        .eq("seller_id", this.uid)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
    ) as Row[];
    return this.hydrate(rows);
  }

  private async fields(id: string, d: ListingDraft, keepPaths: string[]) {
    const invalid = validateListing(d, !!d.photo || keepPaths.length > 0);
    if (invalid) throw new Error(invalid.message);
    let paths = keepPaths;
    if (d.photo) {
      const path = `${this.uid}/${id}/${Date.now()}.jpg`;
      await uploadJpeg(this.db, LISTING_BUCKET, path, d.photo);
      paths = [path];
    }
    return {
      kind: d.kind,
      title: d.title.trim(),
      description: d.description.trim(),
      species_id: (await this.species.uuids())(d.speciesId),
      price_rub: d.kind === "sell" ? d.priceRub : null,
      swap_for: d.kind === "swap" ? d.swapFor.trim() || null : null,
      city: d.city.trim(),
      delivery: d.delivery,
      photo_paths: paths,
    };
  }

  async createListing(d: ListingDraft) {
    const id = crypto.randomUUID();
    const row = check(
      await this.db
        .from("listings")
        .insert({ id, ...(await this.fields(id, d, [])) })
        .select(LISTING_SELECT)
        .single(),
    ) as Row;
    return (await this.hydrate([row]))[0];
  }

  async updateListing(id: string, d: ListingDraft) {
    const cur = check(await this.db.from("listings").select("photo_paths").eq("id", id).eq("seller_id", this.uid).single()) as Row;
    const row = check(
      await this.db
        .from("listings")
        .update(await this.fields(id, d, (cur.photo_paths as string[] | null) ?? []))
        .eq("id", id)
        .eq("seller_id", this.uid)
        .select(LISTING_SELECT)
        .single(),
    ) as Row;
    return (await this.hydrate([row]))[0];
  }

  async setStatus(id: string, status: ListingStatus) {
    check(await this.db.from("listings").update({ status }).eq("id", id).eq("seller_id", this.uid));
  }

  async deleteListing(id: string) {
    check(await this.db.from("listings").update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("seller_id", this.uid));
  }

  /** Удалённые объявления владельцу видны (RLS) и тоже считаются. */
  async myStats() {
    const rows = check(await this.db.from("listings").select("kind, status").eq("seller_id", this.uid).limit(5000)) as Row[];
    return {
      listings: rows.length,
      giveaways: rows.filter((r) => r.kind === "free").length,
      deals: rows.filter((r) => r.status === "closed").length,
    };
  }

  async report(targetType: "listing" | "message" | "profile", targetId: string, reason: string) {
    check(await this.db.from("reports").insert({ target_type: targetType, target_id: targetId, reason }));
  }
}
