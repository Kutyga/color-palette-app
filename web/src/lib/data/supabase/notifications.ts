/**
 * Push-уведомления: подписка браузера, VAPID-ключ сервера и настройки в профиле.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationSettings, NotificationsRepository } from "../repositories";

import { type Row, check } from "./shared";

export class SupabaseNotifications implements NotificationsRepository {
  constructor(
    private db: SupabaseClient,
    private uid: string,
  ) {}

  async publicKey() {
    const { data, error } = await this.db.functions.invoke("push", { body: { action: "config" } });
    if (error || !(data as { publicKey?: string } | null)?.publicKey) throw new Error("Сервис уведомлений недоступен, попробуйте позже");
    return (data as { publicKey: string }).publicKey;
  }

  async subscribe(sub: { endpoint: string; p256dh: string; auth: string }, userAgent: string) {
    check(
      await this.db.rpc("save_push_subscription", {
        p_endpoint: sub.endpoint,
        p_p256dh: sub.p256dh,
        p_auth: sub.auth,
        p_user_agent: userAgent,
      }),
    );
  }

  async unsubscribe(endpoint: string) {
    check(await this.db.from("push_subscriptions").delete().eq("endpoint", endpoint));
  }

  async settings(): Promise<NotificationSettings> {
    const r = check(
      await this.db
        .from("profiles")
        .select("notify_care, notify_messages, notify_community, notify_wishlist, reminder_time, timezone")
        .eq("id", this.uid)
        .single(),
    ) as Row;
    return {
      care: Boolean(r.notify_care),
      messages: Boolean(r.notify_messages),
      community: Boolean(r.notify_community),
      wishlist: Boolean(r.notify_wishlist),
      reminderTime: String(r.reminder_time ?? "09:00").slice(0, 5),
      timezone: (r.timezone as string | null) ?? "UTC",
    };
  }

  async updateSettings(patch: Partial<NotificationSettings>) {
    const row: Row = {};
    if (patch.care !== undefined) row.notify_care = patch.care;
    if (patch.messages !== undefined) row.notify_messages = patch.messages;
    if (patch.community !== undefined) row.notify_community = patch.community;
    if (patch.wishlist !== undefined) row.notify_wishlist = patch.wishlist;
    if (patch.reminderTime !== undefined) row.reminder_time = patch.reminderTime;
    if (patch.timezone !== undefined) row.timezone = patch.timezone;
    check(await this.db.from("profiles").update(row).eq("id", this.uid));
  }
}
