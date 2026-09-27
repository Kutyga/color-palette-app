/**
 * Список «Хочу купить» в Supabase.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WishlistRepository } from "../repositories";

import { type Row, type SpeciesIds, check } from "./shared";

export class SupabaseWishlist implements WishlistRepository {
  constructor(
    private db: SupabaseClient,
    private uid: string,
    private species: SpeciesIds,
  ) {}

  async list() {
    const [rows, slugOf] = await Promise.all([
      this.db.from("wishlist_items").select("species_id").eq("user_id", this.uid).order("created_at", { ascending: false }),
      this.species.slugs(),
    ]);
    return (check(rows) as Row[]).map((r) => slugOf(r.species_id as string)).filter((x): x is string => !!x);
  }

  async set(speciesId: string, wanted: boolean) {
    const uuid = (await this.species.uuids())(speciesId);
    if (!uuid) throw new Error("Вид не найден");
    if (wanted) check(await this.db.from("wishlist_items").upsert({ user_id: this.uid, species_id: uuid }, { ignoreDuplicates: true }));
    else check(await this.db.from("wishlist_items").delete().eq("user_id", this.uid).eq("species_id", uuid));
  }
}
