/** Конкурсы: жеребьёвка совпадает с базой, проверка итогов, равные шансы, правила формы. */
import { describe, expect, it } from "vitest";
import {
  contestPhase,
  drawRanking,
  prizeStatus,
  sha256Hex,
  sortContests,
  validateContest,
  verifyDraw,
  type Contest,
  type ContestDraft,
  type ContestParticipant,
} from "../contest";

const D2 = "00000000-0000-0000-0000-0000000000d2";
const D6 = "00000000-0000-0000-0000-0000000000d6";
const SEED = "podokonnik-test-seed";

/** Участник для проверок: по умолчанию — без места и без отметок вручения. */
const entrant = (userId: string, patch: Partial<ContestParticipant> = {}): ContestParticipant => ({
  userId,
  username: userId,
  displayName: userId,
  rank: null,
  place: null,
  claimDeadline: null,
  claimedAt: null,
  deliveredAt: null,
  forfeitedAt: null,
  ...patch,
});

describe("жеребьёвка", () => {
  it("совпадает с базой: те же SHA-256 и очередь, что в supabase/tests/smoke_test.sql", async () => {
    expect(await sha256Hex(SEED)).toBe("ca00fafc2af1587eb9a0a7300d46e404a0b0f33756ebbb83f3c0ba86241a99b8");
    // u(D2) = 0,3729562971773789, u(D6) = 0,5039346507518477 — первым идёт наибольшее.
    expect(await drawRanking(SEED, [D2, D6])).toEqual([D6, D2]);
  });

  it("проверка итогов ловит подмену победителя, очереди и секрета", async () => {
    const participants = [entrant(D2, { rank: 2 }), entrant(D6, { rank: 1, place: 1 })];
    const contest = { seed: SEED, seedHash: await sha256Hex(SEED), winnersCount: 1 };
    expect(await verifyDraw(contest, participants)).toEqual({ hashOk: true, winnersOk: true });
    const swapped = [entrant(D2, { rank: 2, place: 1 }), entrant(D6, { rank: 1 })];
    expect(await verifyDraw(contest, swapped)).toEqual({ hashOk: true, winnersOk: false });
    const wrongRanks = [entrant(D2, { rank: 1 }), entrant(D6, { rank: 2, place: 1 })];
    expect((await verifyDraw(contest, wrongRanks)).winnersOk).toBe(false);
    expect((await verifyDraw({ ...contest, seed: "другой секрет" }, participants)).hashOk).toBe(false);
    expect(await verifyDraw({ ...contest, seed: null }, participants)).toEqual({ hashOk: false, winnersOk: false });
  });

  it("приз переходит строго следующему по очереди", async () => {
    const [first, second, third] = await drawRanking(SEED, ["a", "b", "c"]);
    const contest = { seed: SEED, seedHash: await sha256Hex(SEED), winnersCount: 1 };
    const ranked = (patch: Record<string, Partial<ContestParticipant>>) =>
      [first, second, third].map((id, i) => entrant(id, { rank: i + 1, ...patch[id] }));
    const passed = ranked({ [first]: { forfeitedAt: new Date() }, [second]: { place: 1 } });
    expect((await verifyDraw(contest, passed)).winnersOk).toBe(true);
    const skipped = ranked({ [first]: { forfeitedAt: new Date() }, [third]: { place: 1 } });
    expect((await verifyDraw(contest, skipped)).winnersOk).toBe(false);
    expect(passed.map(prizeStatus)).toEqual(["forfeited", "waiting", null]);
    expect(prizeStatus(entrant("x", { place: 1, claimedAt: new Date(), deliveredAt: new Date() }))).toBe("delivered");
  });

  it("шансы равны: за 2000 розыгрышей каждый из четырёх выигрывает около четверти раз", async () => {
    const users = ["a", "b", "c", "d"];
    const wins = new Map(users.map((u) => [u, 0]));
    for (let i = 0; i < 2000; i++) {
      const [w] = await drawRanking(`seed-${i}`, users);
      wins.set(w, wins.get(w)! + 1);
    }
    for (const n of wins.values()) expect(n).toBeGreaterThan(420); // ожидание 500, отклонение ~19
  });
});

describe("розыгрыш", () => {
  const draft: ContestDraft = {
    title: "Черенок",
    prize: "Монстера",
    description: "",
    city: "Москва",
    delivery: false,
    winnersCount: 1,
    days: 7,
    photo: null,
  };

  it("правила формы", () => {
    expect(validateContest(draft)).toBeNull();
    expect(validateContest({ ...draft, title: "аб" })).toMatch(/Название/);
    expect(validateContest({ ...draft, winnersCount: 6 })).toMatch(/Победителей/);
    expect(validateContest({ ...draft, days: 31 })).toMatch(/30 дней/);
  });

  it("этапы и порядок: закреплённые сверху, затем идущие по сроку, затем законченные", () => {
    const now = new Date(2026, 8, 28, 12);
    const at = (h: number) => new Date(now.getTime() + h * 3_600_000);
    const c = (id: string, patch: Partial<Contest>) => ({ id, pinned: false, status: "active", endsAt: at(24), ...patch }) as Contest;
    expect(contestPhase(c("x", {}), now)).toBe("active");
    expect(contestPhase(c("x", { endsAt: at(-1) }), now)).toBe("drawing");
    expect(contestPhase(c("x", { status: "finished" }), now)).toBe("finished");
    const sorted = sortContests([
      c("finished", { status: "finished", endsAt: at(-5) }),
      c("later", { endsAt: at(48) }),
      c("pinned", { pinned: true, endsAt: at(100) }),
      c("soon", { endsAt: at(2) }),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(["pinned", "soon", "later", "finished"]);
  });
});
