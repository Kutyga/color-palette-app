/** Конкурсы: жеребьёвка совпадает с базой, проверка итогов, равные шансы, правила формы. */
import { describe, expect, it } from "vitest";
import {
  contestPhase,
  drawWinners,
  sha256Hex,
  sortContests,
  validateContest,
  verifyDraw,
  type Contest,
  type ContestDraft,
} from "../contest";

const D2 = "00000000-0000-0000-0000-0000000000d2";
const D6 = "00000000-0000-0000-0000-0000000000d6";
const SEED = "podokonnik-test-seed";

describe("жеребьёвка", () => {
  it("совпадает с базой: те же SHA-256 и победитель, что в supabase/tests/smoke_test.sql", async () => {
    expect(await sha256Hex(SEED)).toBe("ca00fafc2af1587eb9a0a7300d46e404a0b0f33756ebbb83f3c0ba86241a99b8");
    // u(D2) = 0,3729562971773789, u(D6) = 0,5039346507518477 — побеждает наибольшее.
    expect(await drawWinners(SEED, [D2, D6], 2)).toEqual([D6, D2]);
    expect(await drawWinners(SEED, [D2, D6], 1)).toEqual([D6]);
  });

  it("проверка итогов ловит подмену победителя и секрета", async () => {
    const participants = [
      { userId: D2, username: "egor", displayName: "Егор", place: null },
      { userId: D6, username: "lev", displayName: "Лев", place: 1 },
    ];
    const contest = { seed: SEED, seedHash: await sha256Hex(SEED), winnersCount: 1 };
    expect(await verifyDraw(contest, participants)).toEqual({ hashOk: true, winnersOk: true });
    const swapped = participants.map((p) => ({ ...p, place: p.userId === D2 ? 1 : null }));
    expect(await verifyDraw(contest, swapped)).toEqual({ hashOk: true, winnersOk: false });
    expect((await verifyDraw({ ...contest, seed: "другой секрет" }, participants)).hashOk).toBe(false);
    expect(await verifyDraw({ ...contest, seed: null }, participants)).toEqual({ hashOk: false, winnersOk: false });
  });

  it("шансы равны: за 2000 розыгрышей каждый из четырёх выигрывает около четверти раз", async () => {
    const users = ["a", "b", "c", "d"];
    const wins = new Map(users.map((u) => [u, 0]));
    for (let i = 0; i < 2000; i++) {
      const [w] = await drawWinners(`seed-${i}`, users, 1);
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
