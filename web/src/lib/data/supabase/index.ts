/**
 * Боевой бэкенд: собирает репозитории Supabase для вошедшего пользователя.
 * Доступ к данным ограничивают RLS-политики, пересчёт графиков ухода — триггеры базы.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Backend } from "../repositories";

import { SupabaseChat } from "./chat";
import { SupabaseGarden } from "./garden";
import { PlantNetIdentifier } from "./identifier";
import { SupabaseMarket } from "./market";
import { SupabaseNotifications } from "./notifications";
import { SupabasePeople } from "./people";
import { PROFILE_FIELDS, type Row, SpeciesIds, check, profileFromRow } from "./shared";
import { SupabaseShops } from "./shops";
import { SupabaseSocial } from "./social";
import { SupabaseWishlist } from "./wishlist";

export function supabaseBackend(db: SupabaseClient, uid: string): Backend {
  const species = new SpeciesIds(db);
  return {
    mode: "live",
    garden: new SupabaseGarden(db, uid),
    social: new SupabaseSocial(db, uid, species),
    people: new SupabasePeople(db, uid),
    market: new SupabaseMarket(db, uid, species),
    chat: new SupabaseChat(db, uid),
    shops: new SupabaseShops(db, uid, species),
    wishlist: new SupabaseWishlist(db, uid, species),
    notifications: new SupabaseNotifications(db, uid),
    identifier: new PlantNetIdentifier(db),
    async profile() {
      return profileFromRow(check(await db.from("profiles").select(PROFILE_FIELDS).eq("id", uid).single()) as Row);
    },
  };
}
