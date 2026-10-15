/** Запросы садоводов: переименование, свои группы, запись о нескольких растениях и «Активность». */

import { describe, expect, it } from "vitest";
import { activityFromRow, activityHref } from "../../domain/social";
import { demoBackend, memoryDemoStorage } from "../demo";

const clock = () => new Date(2026, 6, 15, 12);

describe("группы, переименование и записи о нескольких растениях", () => {
  it("растение можно переименовать — новое имя видно в коллекции и в дневнике", async () => {
    const b = await demoBackend(memoryDemoStorage(), clock);
    const [plant] = await b.garden.myPlants();
    await b.social.createPost({ kind: "diary", event: "new_leaf", text: "лист", plantId: plant.id });
    await b.garden.renamePlant(plant.id, "  Бублик ");
    expect((await b.garden.myPlants()).find((p) => p.id === plant.id)?.nickname).toBe("Бублик");
    expect((await b.social.plantDiary(plant.id))[0].plants[0].name).toBe("Бублик");
  });

  it("группы: создать, добавить и убрать растение, переименовать, удалить; одинаковые имена — нельзя", async () => {
    const b = await demoBackend(memoryDemoStorage(), clock);
    const [a, c] = await b.garden.myPlants();
    const g = await b.garden.createGroup("Бонсаи");
    await b.garden.setGroupMember(g.id, a.id, true);
    await b.garden.setGroupMember(g.id, c.id, true);
    await b.garden.setGroupMember(g.id, c.id, false);
    expect((await b.garden.myGroups())[0]).toMatchObject({ name: "Бонсаи", plantIds: [a.id] });
    await expect(b.garden.createGroup(" бонсаи ")).rejects.toThrow(/уже есть/);
    await b.garden.renameGroup(g.id, "Мои бонсаи");
    expect((await b.garden.myGroups())[0].name).toBe("Мои бонсаи");
    await b.garden.deleteGroup(g.id);
    expect(await b.garden.myGroups()).toEqual([]);
    expect((await b.garden.myPlants()).length).toBeGreaterThan(1); // растения на месте
  });

  it("запись «душ всем» попадает в дневник каждого отмеченного растения", async () => {
    const b = await demoBackend(memoryDemoStorage(), clock);
    const [a, c, d] = await b.garden.myPlants();
    const post = await b.social.createPost({ kind: "diary", event: "care", text: "Душ всем", plantId: a.id, alsoPlantIds: [c.id, a.id] });
    expect(post.plants.map((p) => p.id)).toEqual([a.id, c.id]);
    expect((await b.social.plantDiary(c.id)).map((p) => p.id)).toContain(post.id);
    expect((await b.social.plantDiary(d.id)).map((p) => p.id)).not.toContain(post.id);
  });
});

describe("«Активность»", () => {
  it("строка из базы и ссылка: дневник растения с переходом к записи, вопрос, профиль", () => {
    const row = {
      id: "c1",
      kind: "comment",
      created_at: "2026-10-14T08:00:00Z",
      actor_username: "anna_k",
      actor_display_name: null,
      post_id: "p1",
      post_kind: "milestone",
      post_plant_id: "pl1",
      plant_name: "Бублик",
      text: "Какая красота!",
      unread: true,
    };
    const a = activityFromRow(row);
    expect(a).toMatchObject({ kind: "comment", postKind: "diary", plantName: "Бублик", unread: true });
    expect(activityHref(a)).toBe("/feed/plant/?id=pl1#post-p1");
    expect(activityHref(activityFromRow({ ...row, post_kind: "question" }))).toBe("/feed/question/?id=p1");
    expect(activityHref(activityFromRow({ ...row, kind: "follow", post_id: null, post_kind: null }))).toBe("/people/view/?u=anna_k");
  });

  it("демо: ответы других на мои записи — непрочитанные, пока не открыл «Активность»", async () => {
    const b = await demoBackend(memoryDemoStorage(), clock);
    const unread = await b.social.unreadActivity();
    await b.social.markActivitySeen();
    expect(await b.social.unreadActivity()).toBe(0);
    expect((await b.social.activity()).every((a) => !a.unread)).toBe(true);
    expect(unread).toBeGreaterThanOrEqual(0);
  });
});
