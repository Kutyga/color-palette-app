/**
 * Переписка в браузере: продавец из демо отвечает сам.
 */
import type { ChatMessage, Conversation } from "../../domain/market";
import type { ChatRepository } from "../repositories";
import { AUTO_REPLY, personOf } from "./fixtures";
import { type ConversationRec, type DemoState, ME, type MessageRec } from "./state";

export class DemoChat implements ChatRepository {
  private listeners = new Map<string, Set<(m: ChatMessage) => void>>();

  constructor(
    private state: DemoState,
    private persist: () => void,
    private clock: () => Date = () => new Date(),
    private replyDelayMs = 1200,
  ) {}

  private get convs() {
    return (this.state.conversations ??= []);
  }

  private get msgs() {
    return (this.state.messages ??= []);
  }

  private toMessage(m: MessageRec): ChatMessage {
    return { id: m.id, conversationId: m.conversationId, mine: m.fromMe, body: m.body, createdAt: new Date(m.createdAt) };
  }

  async conversations(): Promise<Conversation[]> {
    const blocked = this.state.blocked ?? [];
    return this.convs
      .map((c) => {
        const listing = (this.state.listings ?? []).find((l) => l.id === c.listingId);
        const contest = c.contestId ? (this.state.contests ?? []).find((x) => x.id === c.contestId) : undefined;
        const person = personOf(c.otherId);
        const thread = this.msgs.filter((m) => m.conversationId === c.id);
        const last = thread.at(-1);
        return {
          id: c.id,
          listingId: c.listingId,
          listingTitle: listing?.title ?? (contest ? `🎉 ${contest.title}` : null),
          listingKind: listing?.kind ?? null,
          listingStatus: listing?.status ?? null,
          listingPhotoUrl: listing?.photoUrl ?? contest?.photoUrl ?? null,
          iAmSeller: c.iAmSeller,
          otherId: c.otherId,
          otherName: person?.username ?? "sadovod",
          otherDisplayName: person?.displayName ?? "Садовод",
          lastMessage: last?.body ?? null,
          lastMessageAt: new Date(last?.createdAt ?? 0),
          lastFromMe: last?.fromMe ?? false,
          unread: !!last && !last.fromMe && (!c.readAt || last.createdAt > c.readAt),
          blocked: blocked.includes(c.otherId),
        };
      })
      .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
  }

  async start(listingId: string) {
    const listing = (this.state.listings ?? []).find((l) => l.id === listingId && !l.deleted);
    if (!listing) throw new Error("Объявление не найдено");
    if (listing.sellerId === ME) throw new Error("Это ваше объявление");
    const existing = this.convs.find((c) => c.listingId === listingId);
    if (existing) return existing.id;
    if ((this.state.blocked ?? []).includes(listing.sellerId)) throw new Error("Написать этому садоводу нельзя");
    const c: ConversationRec = { id: crypto.randomUUID(), listingId, otherId: listing.sellerId, iAmSeller: false, readAt: null };
    this.convs.push(c);
    this.persist();
    return c.id;
  }

  async messages(conversationId: string) {
    return this.msgs.filter((m) => m.conversationId === conversationId).map((m) => this.toMessage(m));
  }

  private push(conversationId: string, body: string, fromMe: boolean) {
    const m: MessageRec = { id: crypto.randomUUID(), conversationId, fromMe, body, createdAt: this.clock().toISOString() };
    this.msgs.push(m);
    this.persist();
    return this.toMessage(m);
  }

  async send(conversationId: string, body: string) {
    const c = this.convs.find((x) => x.id === conversationId);
    if (!c) throw new Error("Чат не найден");
    if ((this.state.blocked ?? []).includes(c.otherId)) throw new Error("Написать нельзя: собеседник заблокирован");
    const text = body.trim();
    if (!text) throw new Error("Пустое сообщение");
    const firstFromMe = !this.msgs.some((m) => m.conversationId === conversationId && m.fromMe);
    const mine = this.push(conversationId, text, true);
    if (firstFromMe) {
      setTimeout(() => {
        const reply = this.push(conversationId, AUTO_REPLY, false);
        this.listeners.get(conversationId)?.forEach((fn) => fn(reply));
      }, this.replyDelayMs);
    }
    return mine;
  }

  async markRead(conversationId: string) {
    const c = this.convs.find((x) => x.id === conversationId);
    if (c) c.readAt = this.clock().toISOString();
    this.persist();
  }

  subscribe(conversationId: string, onMessage: (m: ChatMessage) => void) {
    const set = this.listeners.get(conversationId) ?? new Set();
    set.add(onMessage);
    this.listeners.set(conversationId, set);
    return () => void set.delete(onMessage);
  }

  async block(userId: string) {
    this.state.blocked = [...new Set([...(this.state.blocked ?? []), userId])];
    this.persist();
  }
}
