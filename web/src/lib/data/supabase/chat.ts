/**
 * Личные сообщения по объявлениям: чаты, сообщения и доставка новых — через Realtime у Supabase
 * или опросом раз в несколько секунд на своём хостинге, где веб-сокетов нет.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { HAS_REALTIME } from "../../config";
import { conversationFromRow, messageFromRow, type ChatMessage } from "../../domain/market";
import { proxyMode } from "../../net";
import type { ChatRepository } from "../repositories";
import { LISTING_BUCKET, type Row, check, signedUrls } from "./shared";

export class SupabaseChat implements ChatRepository {
  constructor(
    private db: SupabaseClient,
    private uid: string,
  ) {}

  async conversations() {
    const rows = check(await this.db.rpc("my_conversations")) as Row[];
    const urls = await signedUrls(
      this.db,
      LISTING_BUCKET,
      rows.map((r) => r.listing_photo as string | null).filter((p): p is string => !!p),
    );
    return rows.map((r) => conversationFromRow(r, urls.get((r.listing_photo as string | null) ?? "") ?? null));
  }

  async start(listingId: string) {
    const { data, error } = await this.db.rpc("start_conversation", { p_listing: listingId });
    if (error) throw new Error(error.message);
    return data as string;
  }

  async messages(conversationId: string) {
    const rows = check(
      await this.db.from("messages").select("*").eq("conversation_id", conversationId).order("created_at").limit(500),
    ) as Row[];
    return rows.map((r) => messageFromRow(r, this.uid));
  }

  async send(conversationId: string, body: string): Promise<ChatMessage> {
    const { data, error } = await this.db
      .from("messages")
      .insert({ id: crypto.randomUUID(), conversation_id: conversationId, body: body.trim() })
      .select()
      .single();
    if (error?.code === "42501") throw new Error("Написать нельзя: кто-то из вас заблокировал другого");
    if (error) throw new Error(error.message);
    return messageFromRow(data as Row, this.uid);
  }

  async markRead(conversationId: string) {
    check(await this.db.rpc("mark_conversation_read", { p_conversation: conversationId }));
  }

  subscribe(conversationId: string, onMessage: (m: ChatMessage) => void) {
    // Без веб-сокетов (свой сервер или Supabase через свой домен) — новые сообщения опросом.
    if (!HAS_REALTIME || proxyMode()) return this.poll(conversationId, onMessage);
    const channel = this.db
      .channel(`chat:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => onMessage(messageFromRow(payload.new as Row, this.uid)),
      )
      .subscribe();
    return () => void this.db.removeChannel(channel);
  }

  /**
   * Новые сообщения опросом: первый запрос запоминает последнее сообщение, дальше приходят только
   * более новые. Пока вкладка скрыта — реже. Повторы страница отбрасывает по id.
   */
  private poll(conversationId: string, onMessage: (m: ChatMessage) => void) {
    let since: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const seen = new Set<string>();
    const query = () => this.db.from("messages").select("*").eq("conversation_id", conversationId);
    const tick = async () => {
      try {
        if (since === null) {
          const last = check(await query().order("created_at", { ascending: false }).limit(1)) as Row[];
          since = (last[0]?.created_at as string | undefined) ?? new Date(0).toISOString();
        } else {
          const rows = check(await query().gte("created_at", since).order("created_at").limit(100)) as Row[];
          for (const r of rows) {
            if (seen.has(r.id as string)) continue;
            seen.add(r.id as string);
            since = r.created_at as string;
            onMessage(messageFromRow(r, this.uid));
          }
        }
      } catch {
        // Нет сети — попробуем в следующий раз.
      }
      if (!stopped) timer = setTimeout(tick, document.hidden ? 15_000 : 4_000);
    };
    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }

  async block(userId: string) {
    check(await this.db.from("blocks").upsert({ blocker_id: this.uid, blocked_id: userId }, { ignoreDuplicates: true }));
  }
}
