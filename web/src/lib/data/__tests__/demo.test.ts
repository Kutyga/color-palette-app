import { describe, expect, it } from "vitest";
import { demoBackend, memoryDemoStorage } from "../demo-backend";

const clock = () => new Date(2026, 6, 15, 12); // июль: летний коэффициент 0.85

describe("демо-режим", () => {
  it("стартовые данные: растения, просроченный полив, серия дней", async () => {
    const b = await demoBackend(memoryDemoStorage(), clock);
    expect((await b.garden.myPlants()).map((p) => p.nickname)).toContain("Монстера Мося");
    const tasks = await b.garden.dueTasks(new Date(2026, 6, 16));
    expect(tasks.find((t) => t.plantName === "Монстера Мося")?.type).toBe("water");
    const stats = await b.garden.stats();
    expect(stats.bestStreak).toBe(6);
    expect(stats.currentStreak).toBe(6);
    expect(stats.plants).toBe(4);
    expect(stats.petSafe).toBe(1); // калатея
  });

  it("полив пересчитывает график как серверный триггер", async () => {
    const b = await demoBackend(memoryDemoStorage(), clock);
    const plant = await b.garden.addPlant({
      nickname: "Тест",
      speciesSlug: "monstera-deliciosa",
      potMaterial: "plastic",
      lastWateredAt: new Date(2026, 6, 8, 12),
    });
    // Монстера: летом 7 дн. → база 8.2; июль × 0.85, пластик × 1.1, без места × 1 → 7.7
    const details = await b.garden.plantDetails(plant.id);
    const water = details.schedules.find((s) => s.type === "water")!;
    expect(water.intervalDays).toBe(8.2);
    expect(water.nextDueAt!.getTime() - new Date(2026, 6, 8, 12).getTime()).toBe(7.7 * 86_400_000);
    // Подкормка и пересадка — из карточки вида.
    expect(details.schedules.map((s) => s.type)).toEqual(["water", "fertilize", "repot"]);

    await b.garden.logCare(plant.id, "water", { id: "evt-1" });
    await b.garden.logCare(plant.id, "water", { id: "evt-1" }); // повтор не дублирует
    const after = await b.garden.plantDetails(plant.id);
    expect(after.events).toHaveLength(1);
    const w = after.schedules.find((s) => s.type === "water")!;
    expect(w.lastDoneAt).toEqual(clock());
    expect(w.userFactor).toBe(0.98); // полили на 0.7 дня раньше графика
  });

  it("состояние сохраняется между перезагрузками", async () => {
    const storage = memoryDemoStorage();
    const first = await demoBackend(storage, clock);
    await first.garden.addPlant({ nickname: "Новое" });
    const second = await demoBackend(storage, clock);
    expect((await second.garden.myPlants()).some((p) => p.nickname === "Новое")).toBe(true);
  });

  it("дневники: запись, поддержка, комментарий", async () => {
    const b = await demoBackend(memoryDemoStorage(), clock);
    expect(await b.social.diaries("following")).toHaveLength(2);
    expect(await b.social.diaries("all")).toHaveLength(4);
    const plant = (await b.garden.myPlants())[0];
    const post = await b.social.createPost({ kind: "diary", event: "bloom", text: "Зацвела", plantId: plant.id });
    await b.social.setLiked(post.id, true);
    await b.social.addComment(post.id, "Мой комментарий");
    const mine = (await b.social.diaries("following")).find((p) => p.id === post.id)!;
    expect(mine).toMatchObject({ kind: "diary", event: "bloom", likeCount: 1, commentCount: 1, likedByMe: true, mine: true });
    expect(mine.speciesId).not.toBeNull();
    expect((await b.social.plantDiary(plant.id)).map((p) => p.id)).toEqual([post.id]);
    expect(await b.social.myActivity()).toEqual({ posts: 1, likesReceived: 1 });
  });

  it("помощь: вопрос, ответ, лучший ответ", async () => {
    const b = await demoBackend(memoryDemoStorage(), clock);
    const open = await b.social.questions("open");
    expect(open.every((q) => !q.solvedCommentId)).toBe(true);
    expect(open[0].commentCount).toBe(0); // без ответов — первыми
    expect((await b.social.questions("my_species")).length).toBeGreaterThan(0);
    const q = await b.social.createPost({ kind: "question", text: "Почему сохнут кончики листьев?" });
    expect(q).toMatchObject({ kind: "question", event: null });
    const answer = await b.social.addComment(q.id, "Сухой воздух");
    await b.social.markSolved(q.id, answer.id);
    expect((await b.social.post(q.id))!.solvedCommentId).toBe(answer.id);
    expect((await b.social.questions("open")).some((p) => p.id === q.id)).toBe(false);
    expect((await b.social.questions("mine")).map((p) => p.id)).toEqual([q.id]);
    await expect(b.social.markSolved(q.id, "demo-question-0-a0")).rejects.toThrow();
    await b.social.deleteComment(answer.id);
    expect((await b.social.post(q.id))!.solvedCommentId).toBeNull();
  });
});
