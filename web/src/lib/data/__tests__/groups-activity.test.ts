/** Запросы садоводов: переименование, свои группы, запись о нескольких растениях и «Активность». */

import { describe, expect, it, vi } from "vitest";
import { activityFromRow, activityHref, canEditPhotos } from "../../domain/social";
import type * as Image from "../../image";
import { demoBackend, memoryDemoStorage } from "../demo";
import { ME } from "../demo/state";

const clock = () => new Date(2026, 6, 15, 12);

// В Node нет FileReader: демо хранит фото как data-URL — подменяем уникальной строкой.
let photoNo = 0;
vi.mock("../../image", async (orig) => ({
  ...(await orig<typeof Image>()),
  blobToDataUrl: async () => `data:image/jpeg;base64,${++photoNo}`,
}));

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

  it("группа личная по умолчанию; открытую с растениями видно в профиле, пустую — нет", async () => {
    const b = await demoBackend(memoryDemoStorage(), clock);
    const [a] = await b.garden.myPlants();
    const g = await b.garden.createGroup("Бонсаи");
    const empty = await b.garden.createGroup("Кактусы");
    expect(g.isPublic).toBe(false);
    await b.garden.setGroupMember(g.id, a.id, true);
    expect(await b.people.groupsOf(ME)).toEqual([]);
    await b.garden.setGroupPublic(g.id, true);
    await b.garden.setGroupPublic(empty.id, true);
    expect((await b.garden.myGroups()).map((x) => x.isPublic)).toEqual([true, true]);
    expect(await b.people.groupsOf(ME)).toEqual([{ id: g.id, name: "Бонсаи", plantIds: [a.id], isPublic: true }]);
    await b.garden.setGroupPublic(g.id, false);
    expect(await b.people.groupsOf(ME)).toEqual([]);
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

describe("правка фото публикации", () => {
  const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" });

  it("фото записи дневника меняются и через сутки: убрать лишнее, добавить новое, хотя бы одно остаётся", async () => {
    let now = clock();
    const b = await demoBackend(memoryDemoStorage(), () => now);
    const [plant] = await b.garden.myPlants();
    const post = await b.social.createPost({ kind: "diary", event: "progress", text: "", plantId: plant.id, photos: [jpeg(), jpeg()] });
    expect(post.photoKeys).toHaveLength(2);
    now = new Date(now.getTime() + 24 * 3600_000);
    expect(canEditPhotos(post, now)).toBe(true);
    await expect(b.social.updatePost(post.id, { text: "поздно" })).rejects.toThrow(/часа/);

    const [, hleb] = post.photoKeys;
    const edited = await b.social.updatePostPhotos(post.id, [{ add: jpeg() }, { keep: hleb }]);
    expect(edited.photoUrls).toHaveLength(2);
    expect(edited.photoKeys[1]).toBe(hleb);
    expect(edited.editedAt).not.toBeNull();
    const one = await b.social.updatePostPhotos(post.id, [{ keep: edited.photoKeys[0] }]);
    expect(one.photoUrls).toHaveLength(1);
    await expect(b.social.updatePostPhotos(post.id, [])).rejects.toThrow(/хотя бы одно/);
    await expect(b.social.updatePostPhotos(post.id, [{ keep: "чужое" }])).rejects.toThrow(/обновите/);
  });

  it("у вопроса фото, как и текст, можно менять только в первый час", async () => {
    let now = clock();
    const b = await demoBackend(memoryDemoStorage(), () => now);
    const q = await b.social.createPost({ kind: "question", text: "Почему желтеют листья у фикуса?", photos: [jpeg()] });
    expect(canEditPhotos(q, now)).toBe(true);
    await b.social.updatePostPhotos(q.id, []);
    now = new Date(now.getTime() + 2 * 3600_000);
    expect(canEditPhotos(q, now)).toBe(false);
    await expect(b.social.updatePostPhotos(q.id, [{ add: jpeg() }])).rejects.toThrow(/часа/);
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
