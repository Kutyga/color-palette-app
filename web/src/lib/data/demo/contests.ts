/**
 * Конкурсы в браузере. Итоги и передача неподтверждённых призов — при чтении, когда время вышло,
 * тем же расчётом, что в базе и в проверке на странице (drawRanking). Возраст аккаунта демо-гостя
 * не проверяется: он появился только что, иначе поучаствовать было бы нельзя.
 */
import {
  CONTEST_RULES,
  drawRanking,
  sha256Hex,
  sortContests,
  validateContest,
  type Contest,
  type ContestDraft,
} from "../../domain/contest";
import { sameCity } from "../../domain/market";
import { blobToDataUrl } from "../../image";
import { DAY_MS, HOUR_MS } from "../../time";
import type { ContestRepository } from "../repositories";
import { DEFAULT_PROFILE, personOf } from "./fixtures";
import { type ContestEntryRec, type ContestRec, type DemoState, ME } from "./state";

/** Организатор закреплённых конкурсов в демо — команда «Подоконника». */
export const DEMO_ADMIN = "demo-podokonnik";
const FINISHED_VISIBLE_MS = 14 * DAY_MS;

/** Секрет жеребьёвки: 32 случайных байта в hex. */
export function newSecret(): string {
  return [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Место победителю: срок на подтверждение; если это гость — чат с организатором. */
function awardPlace(state: DemoState, c: ContestRec, e: ContestEntryRec, place: number, now: Date) {
  e.place = place;
  e.claimDeadline = new Date(now.getTime() + CONTEST_RULES.claimHours * HOUR_MS).toISOString();
  const convs = (state.conversations ??= []);
  if (e.userId === ME && c.organizerId !== ME && !convs.some((x) => x.contestId === c.id)) {
    convs.push({ id: crypto.randomUUID(), listingId: null, contestId: c.id, otherId: c.organizerId, iAmSeller: false, readAt: null });
  }
}

/** Место переходит следующему по очереди, кто ещё не побеждал и не отказывался. */
function passPrize(state: DemoState, c: ContestRec, e: ContestEntryRec, now: Date) {
  const vacated = e.place;
  if (vacated == null || e.deliveredAt) return;
  e.place = null;
  e.forfeitedAt = now.toISOString();
  const next = c.entries.filter((x) => x.place == null && !x.forfeitedAt).sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))[0];
  if (next) awardPlace(state, c, next, vacated, now);
}

/** Итоги розыгрыша: очередь всем участникам, места — первым в очереди, секрет раскрыт. */
export async function finishContest(state: DemoState, c: ContestRec, now: Date) {
  const ranking = await drawRanking(
    c.secret,
    c.entries.map((e) => e.userId),
  );
  for (const e of c.entries) {
    e.rank = ranking.indexOf(e.userId) + 1;
    e.place = null;
  }
  c.status = "finished";
  c.seed = c.secret;
  for (const e of c.entries) if (e.rank! <= c.winnersCount) awardPlace(state, c, e, e.rank!, now);
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

  /** Время вышло — итоги и передача неподтверждённых призов (в базе это pg_cron раз в 5 минут). */
  private async finishDue() {
    const now = this.clock();
    const due = this.recs.filter((c) => c.status === "active" && new Date(c.endsAt) <= now);
    for (const c of due) await finishContest(this.state, c, now);
    // Демо-данные, сохранённые до появления очереди: восстанавливаем её из раскрытого секрета.
    let changed = due.length > 0;
    for (const c of this.recs)
      if (c.status === "finished" && c.entries.some((e) => e.rank == null)) {
        const ranking = await drawRanking(
          c.secret,
          c.entries.map((e) => e.userId),
        );
        for (const e of c.entries) e.rank = ranking.indexOf(e.userId) + 1;
        changed = true;
      }
    for (const c of this.recs)
      for (const e of [...c.entries].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0)))
        if (e.place != null && !e.claimedAt && e.claimDeadline && new Date(e.claimDeadline) <= now) {
          passPrize(this.state, c, e, now);
          changed = true;
        }
    if (changed) this.persist();
  }

  /** Запись гостя-победителя в розыгрыше. */
  private myWin(id: string) {
    const e = this.find(id).entries.find((x) => x.userId === ME && x.place != null);
    if (!e) throw new Error("Вы не победитель этого розыгрыша");
    return e;
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
    await this.finishDue();
    const c = this.find(id);
    return [...c.entries]
      .sort(
        (a, b) =>
          (a.place ?? Infinity) - (b.place ?? Infinity) ||
          (a.rank ?? Infinity) - (b.rank ?? Infinity) ||
          a.createdAt.localeCompare(b.createdAt),
      )
      .map((e) => {
        const person = personOf(e.userId);
        return {
          userId: e.userId,
          username: e.userId === ME ? this.me.username : (person?.username ?? "sadovod"),
          displayName: e.userId === ME ? (this.me.displayName ?? "Вы") : (person?.displayName ?? "Садовод"),
          rank: e.rank ?? null,
          place: e.place,
          claimDeadline: e.claimDeadline ? new Date(e.claimDeadline) : null,
          claimedAt: e.claimedAt ? new Date(e.claimedAt) : null,
          deliveredAt: e.deliveredAt ? new Date(e.deliveredAt) : null,
          forfeitedAt: e.forfeitedAt ? new Date(e.forfeitedAt) : null,
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

  async claim(id: string) {
    await this.finishDue();
    const e = this.myWin(id);
    if (e.claimedAt) return;
    if (!e.claimDeadline || new Date(e.claimDeadline) <= this.clock()) throw new Error("Срок подтверждения вышел");
    e.claimedAt = this.clock().toISOString();
    this.persist();
  }

  async decline(id: string) {
    const e = this.myWin(id);
    if (e.deliveredAt) throw new Error("Приз уже вручён");
    passPrize(this.state, this.find(id), e, this.clock());
    this.persist();
  }

  async markDelivered(id: string, userId: string) {
    const c = this.find(id);
    if (c.organizerId !== ME) throw new Error("Отметить вручение может только организатор");
    const e = c.entries.find((x) => x.userId === userId && x.place != null);
    if (!e?.claimedAt) throw new Error("Сначала победитель должен подтвердить, что забирает приз");
    e.deliveredAt = this.clock().toISOString();
    this.persist();
  }
}
