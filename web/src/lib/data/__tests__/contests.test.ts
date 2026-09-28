/** Розыгрыши в демо-режиме: условия участия, итоги по времени, чат победителя, проверка честности. */
import { describe, expect, it } from "vitest";
import { verifyDraw, type ContestDraft } from "../../domain/contest";
import { demoBackend, memoryDemoStorage } from "../demo";

const start = new Date(2026, 8, 28, 12);

describe("розыгрыши в демо-режиме", () => {
  it("закреплённый конкурс «Подоконника» — первым; законченный проходит проверку честности", async () => {
    const b = await demoBackend(memoryDemoStorage(), () => start);
    const list = await b.contests.contests();
    expect(list[0]).toMatchObject({ pinned: true, status: "active", organizerDisplayName: "Подоконник" });
    const finished = list.find((c) => c.status === "finished")!;
    expect(finished.seed).not.toBeNull();
    expect(await verifyDraw(finished, await b.contests.participants(finished.id))).toEqual({ hashOk: true, winnersOk: true });
    expect(list.filter((c) => c.status === "active").every((c) => c.seed === null && /^[0-9a-f]{64}$/.test(c.seedHash))).toBe(true);
  });

  it("условия участия, один свой розыгрыш, отмена без участников", async () => {
    const b = await demoBackend(memoryDemoStorage(), () => start);
    await b.contests.join("demo-contest-monstera"); // Москва, как у гостя
    await b.contests.join("demo-contest-monstera"); // повтор ничего не ломает
    expect(await b.contests.contest("demo-contest-monstera")).toMatchObject({ joined: true, participants: 3 });
    await b.contests.leave("demo-contest-monstera");
    expect((await b.contests.contest("demo-contest-monstera"))?.joined).toBe(false);

    const draft: ContestDraft = {
      title: "Детка хойи",
      prize: "Хойя керри",
      description: "",
      city: "Казань",
      delivery: false,
      winnersCount: 1,
      days: 3,
      photo: null,
    };
    const mine = await b.contests.create(draft);
    expect(mine).toMatchObject({ mine: true, pinned: false, participants: 0 });
    await expect(b.contests.create(draft)).rejects.toThrow(/один розыгрыш/);
    await expect(b.contests.join(mine.id)).rejects.toThrow(/своём/);
    await b.contests.cancel(mine.id);
    expect((await b.contests.contest(mine.id))?.status).toBe("cancelled");
  });

  it("без доставки участвуют только из того же города", async () => {
    const b = await demoBackend(memoryDemoStorage(), () => start);
    await b.people.updateProfile({ username: "gost", displayName: "Гость", bio: "", city: "Казань" });
    await expect(b.contests.join("demo-contest-monstera")).rejects.toThrow(/Москва/);
    await b.contests.join("demo-contest-autumn"); // с доставкой — можно из любого города
  });

  it("время вышло — итоги подведены, у победителя-гостя чат с организатором", async () => {
    let now = start;
    const b = await demoBackend(memoryDemoStorage(), () => now);
    await b.contests.join("demo-contest-autumn");
    now = new Date(start.getTime() + 6 * 86_400_000);
    const c = (await b.contests.contest("demo-contest-autumn"))!;
    expect(c.status).toBe("finished");
    const people = await b.contests.participants(c.id);
    expect(people.filter((p) => p.place != null)).toHaveLength(3);
    expect(await verifyDraw(c, people)).toEqual({ hashOk: true, winnersOk: true });
    const iWon = people.some((p) => p.username === "gost" && p.place != null);
    const chats = await b.chat.conversations();
    expect(chats.some((x) => x.listingTitle === `🎉 ${c.title}`)).toBe(iWon);
    await expect(b.contests.join(c.id)).rejects.toThrow(/закончился/);
  });

  it("вручение: победитель подтверждает, молчание 72 часа передаёт приз следующему", async () => {
    let now = start;
    const b = await demoBackend(memoryDemoStorage(), () => now);
    await b.contests.join("demo-contest-monstera"); // один победитель, участников трое
    now = new Date(start.getTime() + 3 * 86_400_000);
    const id = "demo-contest-monstera";
    const before = await b.contests.participants(id);
    const winner = before.find((p) => p.place === 1)!;
    expect(winner.claimDeadline!.getTime() - now.getTime()).toBe(72 * 3_600_000);
    if (winner.username === "gost") {
      await b.contests.claim(id);
      expect((await b.contests.participants(id)).find((p) => p.username === "gost")?.claimedAt).not.toBeNull();
      await expect(b.contests.markDelivered(id, winner.userId)).rejects.toThrow(/организатор/);
    } else {
      await expect(b.contests.claim(id)).rejects.toThrow(/не победитель/);
    }
    // Победитель-демо не подтверждает: через 72 часа место переходит второму в очереди.
    const second = before.find((p) => p.rank === 2)!;
    if (winner.username !== "gost") {
      now = new Date(now.getTime() + 73 * 3_600_000);
      const after = await b.contests.participants(id);
      expect(after.find((p) => p.userId === winner.userId)).toMatchObject({ place: null });
      expect(after.find((p) => p.userId === winner.userId)?.forfeitedAt).not.toBeNull();
      expect(after.find((p) => p.userId === second.userId)?.place).toBe(1);
      const c = (await b.contests.contest(id))!;
      expect(await verifyDraw(c, after)).toEqual({ hashOk: true, winnersOk: true });
    }
  });

  it("организатор отмечает вручение после подтверждения; отказ передаёт приз дальше", async () => {
    let now = start;
    const b = await demoBackend(memoryDemoStorage(), () => now);
    const draft: ContestDraft = {
      title: "Детка хойи",
      prize: "Хойя",
      description: "",
      city: "Москва",
      delivery: true,
      winnersCount: 1,
      days: 1,
      photo: null,
    };
    const mine = await b.contests.create(draft);
    now = new Date(start.getTime() + 2 * 86_400_000);
    expect((await b.contests.contest(mine.id))?.status).toBe("finished");
    expect(await b.contests.participants(mine.id)).toEqual([]); // никто не участвовал — места свободны
    await expect(b.contests.decline(mine.id)).rejects.toThrow(/не победитель/);
  });
});
