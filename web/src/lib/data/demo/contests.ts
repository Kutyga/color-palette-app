/**
 * Конкурсы в браузере. Итоги подводятся при чтении, когда время вышло, — тем же расчётом,
 * что в базе и в проверке на странице (drawWinners). Возраст аккаунта демо-гостя не проверяется:
 * он появился только что, иначе поучаствовать было бы нельзя.
 */
import { drawWinners, sha256Hex, sortContests, validateContest, type Contest, type ContestDraft } from "../../domain/contest";
import { sameCity } from "../../domain/market";
import { blobToDataUrl } from "../../image";
import { DAY_MS } from "../../time";
import type { ContestRepository } from "../repositories";
import { DEFAULT_PROFILE, personOf } from "./fixtures";
import { type ContestRec, type DemoState, ME } from "./state";

/** Организатор закреплённых конкурсов в демо — команда «Подоконника». */
export const DEMO_ADMIN = "demo-podokonnik";
const FINISHED_VISIBLE_MS = 14 * DAY_MS;

/** Секрет жеребьёвки: 32 случайных байта в hex. */
export function newSecret(): string {
  return [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Итоги розыгрыша: места победителей, раскрытый секрет, чат победителя-гостя с организатором. */
export async function finishContest(state: DemoState, c: ContestRec) {
  const winners = await drawWinners(
    c.secret,
    c.entries.map((e) => e.userId),
    c.winnersCount,
  );
  for (const e of c.entries) e.place = winners.includes(e.userId) ? winners.indexOf(e.userId) + 1 : null;
  c.status = "finished";
  c.seed = c.secret;
  if (winners.includes(ME) && c.organizerId !== ME) {
    (state.conversations ??= []).push({
      id: crypto.randomUUID(),
      listingId: null,
      contestId: c.id,
      otherId: c.organizerId,
      iAmSeller: false,
      readAt: null,
    });
  }
}

export class DemoContests implements ContestRepository {
  constructor(
    private state: DemoState,
    private persist: () => void,
    private clock: () => Date = () => new Date(),
  ) {}

  private get recs() {
    return (this.state.contests ??= []);
  }

  private get me() {
    return { ...DEFAULT_PROFILE, ...this.state.profile };
  }

  /** Время вышло — подводим итоги (в базе это делает pg_cron раз в 5 минут). */
  private async finishDue() {
    const now = this.clock();
    const due = this.recs.filter((c) => c.status === "active" && new Date(c.endsAt) <= now);
    for (const c of due) await finishContest(this.state, c);
    if (due.length) this.persist();
  }

  private toContest(c: ContestRec): Contest {
    const person = personOf(c.organizerId);
    const [name, display] =
      c.organizerId === ME
        ? [this.me.username, this.me.displayName ?? "Вы"]
        : c.organizerId === DEMO_ADMIN
          ? ["podokonnik", "Подоконник"]
          : [person?.username ?? "sadovod", person?.displayName ?? "Садовод"];
    return {
      id: c.id,
      organizerId: c.organizerId,
      organizerName: name,
      organizerDisplayName: display,
      title: c.title,
      prize: c.prize,
      description: c.description,
      photoUrl: c.photoUrl,
      city: c.city,
      delivery: c.delivery,
      winnersCount: c.winnersCount,
      endsAt: new Date(c.endsAt),
      pinned: c.pinned,
      status: c.status,
      seedHash: c.seedHash,
      seed: c.status === "finished" ? c.secret : null,
      createdAt: new Date(c.createdAt),
      participants: c.entries.length,
      joined: c.entries.some((e) => e.userId === ME),
      mine: c.organizerId === ME,
    };
  }

  private find(id: string) {
    const c = this.recs.find((x) => x.id === id);
    if (!c || (c.status === "cancelled" && c.organizerId !== ME)) throw new Error("Розыгрыш не найден");
    return c;
  }

  async contests() {
    await this.finishDue();
    const since = this.clock().getTime() - FINISHED_VISIBLE_MS;
    return sortContests(
      this.recs
        .filter((c) => c.status === "active" || (c.status === "finished" && new Date(c.endsAt).getTime() >= since))
        .map((c) => this.toContest(c)),
    );
  }

  async contest(id: string) {
    await this.finishDue();
    const c = this.recs.find((x) => x.id === id);
    return c && (c.status !== "cancelled" || c.organizerId === ME) ? this.toContest(c) : null;
  }

  async participants(id: string) {
    const c = this.find(id);
    return [...c.entries]
      .sort((a, b) => (a.place ?? Infinity) - (b.place ?? Infinity) || a.createdAt.localeCompare(b.createdAt))
      .map((e) => {
        const person = personOf(e.userId);
        return {
          userId: e.userId,
          username: e.userId === ME ? this.me.username : (person?.username ?? "sadovod"),
          displayName: e.userId === ME ? (this.me.displayName ?? "Вы") : (person?.displayName ?? "Садовод"),
          place: e.place,
        };
      });
  }

  async create(d: ContestDraft) {
    const invalid = validateContest(d);
    if (invalid) throw new Error(invalid);
    if (this.recs.some((c) => c.organizerId === ME && c.status === "active")) throw new Error("Одновременно можно проводить один розыгрыш");
    const now = this.clock();
    const secret = newSecret();
    const rec: ContestRec = {
      id: crypto.randomUUID(),
      organizerId: ME,
      title: d.title.trim(),
      prize: d.prize.trim(),
      description: d.description.trim(),
      photoUrl: d.photo ? await blobToDataUrl(d.photo) : null,
      city: d.city.trim(),
      delivery: d.delivery,
      winnersCount: d.winnersCount,
      endsAt: new Date(now.getTime() + d.days * DAY_MS).toISOString(),
      pinned: this.me.isAdmin,
      status: "active",
      seedHash: await sha256Hex(secret),
      seed: null,
      secret,
      createdAt: now.toISOString(),
      entries: [],
    };
    this.recs.push(rec);
    this.persist();
    return this.toContest(rec);
  }

  async join(id: string) {
    const c = this.find(id);
    if (c.status !== "active" || new Date(c.endsAt) <= this.clock()) throw new Error("Розыгрыш уже закончился");
    if (c.organizerId === ME) throw new Error("В своём розыгрыше участвовать нельзя");
    if ((this.state.blocked ?? []).includes(c.organizerId)) throw new Error("Участвовать в этом розыгрыше нельзя");
    if (!this.state.plants.length) throw new Error("Добавьте в коллекцию растение со своим фото");
    if (!c.delivery && !sameCity(this.me.city ?? "", c.city)) throw new Error(`Без доставки — только для садоводов из города ${c.city}`);
    if (c.entries.some((e) => e.userId === ME)) return;
    c.entries.push({ userId: ME, createdAt: this.clock().toISOString(), place: null });
    this.persist();
  }

  async leave(id: string) {
    const c = this.find(id);
    if (c.status !== "active") return;
    c.entries = c.entries.filter((e) => e.userId !== ME);
    this.persist();
  }

  async cancel(id: string) {
    const c = this.find(id);
    if (c.status !== "active" || !(this.me.isAdmin || (c.organizerId === ME && c.entries.length === 0)))
      throw new Error("Отменить нельзя: в розыгрыше уже есть участники");
    c.status = "cancelled";
    this.persist();
  }
}
