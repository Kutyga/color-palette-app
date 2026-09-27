/**
 * Садоводы в Supabase: поиск, профили, подписчики и растения других садоводов.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { personFromRow, validateProfile, type ProfileUpdate } from "../../domain/people";
import { coverPathOf } from "../../domain/plant";
import type { PeopleRepository, Profile } from "../repositories";

import { PLANT_BUCKET, PROFILE_FIELDS, type Row, check, profileFromRow, signedUrls } from "./shared";

export class SupabasePeople implements PeopleRepository {
  constructor(
    private db: SupabaseClient,
    private uid: string,
  ) {}

  async search(query: string) {
    const rows = check(await this.db.rpc("search_people", { q: query.trim(), lim: 30 })) as Row[];
    return rows.map(personFromRow);
  }

  async byUsername(username: string) {
    const row = check(await this.db.from("profile_cards").select().eq("username", username.toLowerCase()).maybeSingle());
    return row ? personFromRow(row as Row) : null;
  }

  async followers(userId: string) {
    return (check(await this.db.rpc("people_followers", { p_user: userId })) as Row[]).map(personFromRow);
  }

  async following(userId: string) {
    return (check(await this.db.rpc("people_following", { p_user: userId })) as Row[]).map(personFromRow);
  }

  async plantsOf(userId: string) {
    // RLS отдаёт только растения, которые разрешено видеть (публичные и «для подписчиков»).
    const rows = check(
      await this.db
        .from("plants")
        .select("id, nickname, species(slug), cover:plant_photos!plants_cover_photo_fk(storage_path)")
        .eq("owner_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
    ) as Row[];
    const urls = await signedUrls(
      this.db,
      PLANT_BUCKET,
      rows.map(coverPathOf).filter((p): p is string => !!p),
    );
    return rows.map((r) => ({
      id: r.id as string,
      nickname: r.nickname as string,
      speciesSlug: (r.species as { slug?: string } | null)?.slug ?? null,
      photoUrl: urls.get(coverPathOf(r) ?? "") ?? null,
    }));
  }

  async updateProfile(update: ProfileUpdate): Promise<Profile> {
    const invalid = validateProfile(update);
    if (invalid) throw new Error(invalid.message);
    const { data, error } = await this.db
      .from("profiles")
      .update({
        display_name: update.displayName.trim(),
        username: update.username,
        bio: update.bio.trim() || null,
        ...(update.city !== undefined ? { city: update.city.trim() || null } : {}),
      })
      .eq("id", this.uid)
      .select(PROFILE_FIELDS)
      .single();
    if (error?.code === "23505") throw new Error(`Имя @${update.username} уже занято — выберите другое`);
    if (error) throw new Error(error.message);
    return profileFromRow(data as Row);
  }
}
