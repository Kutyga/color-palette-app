/** Ответы и «сердечки» в комментариях, несколько фото в записи, страница растения, видимость, поиск порциями. */

import { beforeAll, describe, expect, it, vi } from "vitest";
import { commentThreads } from "../../domain/social";
import { demoBackend, memoryDemoStorage } from "../demo";

const clock = () => new Date(2026, 6, 15, 12);

// В Node нет FileReader: демо хранит фото как data URL — подменяем простым чтением Blob.
beforeAll(() => {
  vi.stubGlobal(
    "FileReader",
    class {
      result: string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      error = null;
      readAsDataURL(blob: Blob) {
        void blob.text().then((t) => {
          this.result = `data:${blob.type};base64,${btoa(t)}`;
          this.onload?.();
        });
      }
    },
  );
});

describe("комментарии: ответы и сердечки", () => {
  it("ответ на ответ попадает в ветку корневого комментария", async () => {
    const b = await demoBackend(memoryDemoStorage(), clock);
    const [post] = await b.social.diaries("all");
    const [root] = await b.social.comments(post.id);
    const reply = await b.social.addComment(post.id, "Спасибо!", root.id);
    expect(reply.parentId).toBe(root.id);
    const deeper = await b.social.addComment(post.id, "И вам", reply.id);
    expect(deeper.parentId).toBe(root.id);
    await expect(b.social.addComment(post.id, "?", "нет-такого")).rejects.toThrow(/не найден/);

    const threads = commentThreads(await b.social.comments(post.id));
    const mine = threads.find((t) => t.root.id === root.id)!;
    expect(mine.replies.map((r) => r.text)).toEqual(["Спасибо!", "И вам"]);
    expect(threads.every((t) => !t.root.parentId)).toBe(true);
  });

  it("сердечко ставится и снимается, повтор не накручивает", async () => {
    const b = await demoBackend(memoryDemoStorage(), clock);
    const [post] = await b.social.diaries("all");
    const [c] = await b.social.comments(post.id);
    await b.social.setCommentLiked(c.id, true);
    await b.social.setCommentLiked(c.id, true);
    let after = (await b.social.comments(post.id)).find((x) => x.id === c.id)!;
    expect(after.likeCount).toBe(1);
    expect(after.likedByMe).toBe(true);
    await b.social.setCommentLiked(c.id, false);
    after = (await b.social.comments(post.id)).find((x) => x.id === c.id)!;
    expect(after.likeCount).toBe(0);
  });
});

describe("записи и растения", () => {
  it("запись с несколькими фото: обложка — первое", async () => {
    const b = await demoBackend(memoryDemoStorage(), clock);
    const plant = (await b.garden.myPlants())[0];
    const photos = [new Blob(["a"], { type: "image/jpeg" }), new Blob(["b"], { type: "image/jpeg" })];
    const post = await b.social.createPost({ kind: "diary", event: "new_leaf", text: "Росток и всё растение", plantId: plant.id, photos });
    expect(post.photoUrls).toHaveLength(2);
    expect(post.photoUrl).toBe(post.photoUrls[0]);
  });

  it("чужое растение открывается с хозяином, своё — с отметкой «моё»; видимость меняется", async () => {
    const b = await demoBackend(memoryDemoStorage(), clock);
    const [anna] = await b.people.search("anna");
    const [first] = await b.people.plantsOf(anna.id);
    const info = await b.people.plant(first.id);
    expect(info).toMatchObject({ nickname: first.nickname, ownerName: "anna.green", mine: false });
    // id растения на карточке профиля совпадает с id в записях дневника — открывается его дневник.
    const diary = await b.social.diaries("all");
    expect(diary.some((p) => p.plantId === first.id)).toBe(true);

    const own = (await b.garden.myPlants())[0];
    expect((await b.people.plant(own.id))?.mine).toBe(true);
    await b.garden.setVisibility(own.id, "private");
    expect((await b.garden.myPlants())[0].visibility).toBe("private");
    expect(await b.people.plant("нет-такого")).toBeNull();
  });

  it("поиск садоводов: порциями и «новые»", async () => {
    const b = await demoBackend(memoryDemoStorage(), clock);
    const popular = await b.people.search("", "popular");
    const fresh = await b.people.search("", "new");
    expect(fresh.map((p) => p.id).sort()).toEqual(popular.map((p) => p.id).sort());
    expect(await b.people.search("", "popular", popular.length)).toEqual([]);
  });
});
