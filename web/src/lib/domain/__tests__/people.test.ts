import { describe, expect, it } from "vitest";
import { demoBackend, memoryDemoStorage } from "../../data/demo-backend";
import { normalizeUsername, personFromRow, prettyUsername, validateProfile } from "../people";

describe("профиль садовода", () => {
  it("прячет технический суффикс username и берёт имя из профиля", () => {
    expect(prettyUsername("maxim_1a2b3c4d")).toBe("maxim");
    expect(prettyUsername("anna_green")).toBe("anna_green");
    const p = personFromRow({ id: "u", username: "maxim_1a2b3c4d", display_name: null, followers: "3", is_me: true });
    expect(p.displayName).toBe("maxim");
    expect(p.followers).toBe(3);
    expect(p.isMe).toBe(true);
    expect(personFromRow({ id: "u", username: "x_y", display_name: "  Макс  " }).displayName).toBe("Макс");
  });

  it("нормализует и проверяет username", () => {
    expect(normalizeUsername(" @Anna.Green ")).toBe("anna_green");
    expect(normalizeUsername("Мой сад 2")).toBe("_2");
    expect(validateProfile({ displayName: "Макс", username: "max_k", bio: "" })).toBeNull();
    expect(validateProfile({ displayName: " ", username: "max_k", bio: "" })?.field).toBe("displayName");
    expect(validateProfile({ displayName: "Макс", username: "mx", bio: "" })?.field).toBe("username");
    expect(validateProfile({ displayName: "Макс", username: "max", bio: "x".repeat(501) })?.field).toBe("bio");
  });
});

describe("люди в демо-режиме", () => {
  const clock = () => new Date(2026, 6, 15, 12);

  it("поиск, подписка и списки подписчиков", async () => {
    const b = await demoBackend(memoryDemoStorage(), clock);
    const popular = await b.people.search("");
    expect(popular[0].username).toBe("orchid.mood");
    expect(popular.some((p) => p.isMe)).toBe(false);

    const [papa] = await b.people.search("папа");
    expect(papa.username).toBe("fikus_papa");
    expect(papa.followsMe).toBe(true);

    await b.social.setFollowing(papa.id, true);
    const after = await b.people.byUsername("fikus_papa");
    expect(after?.isFollowing).toBe(true);
    expect(after?.followers).toBe(papa.followers + 1);

    const me = (await b.people.byUsername("gost"))!;
    expect(me.isMe).toBe(true);
    // В демо изначально есть подписки на anna.green и orchid.mood.
    expect((await b.people.following(me.id)).map((p) => p.username)).toEqual(["anna.green", "fikus_papa", "orchid.mood"]);
    expect(me.following).toBe(3);
    expect((await b.people.followers(me.id)).map((p) => p.username).sort()).toEqual(["fikus_papa", "succulove"]);
    expect((await b.people.followers(papa.id)).some((p) => p.isMe)).toBe(true);
    expect((await b.people.plantsOf(papa.id)).map((p) => p.speciesSlug)).toContain("ficus-lyrata");
  });

  it("редактирование профиля и занятый username", async () => {
    const storage = memoryDemoStorage();
    const b = await demoBackend(storage, clock);
    await expect(b.people.updateProfile({ displayName: "Макс", username: "fikus_papa", bio: "" })).rejects.toThrow("уже занято");
    await b.people.updateProfile({ displayName: "Макс", username: "max_green", bio: "Люблю фикусы" });
    const again = await demoBackend(storage, clock);
    expect(await again.profile()).toEqual({ username: "max_green", displayName: "Макс", bio: "Люблю фикусы" });
    expect((await again.people.search("макс"))[0].isMe).toBe(true);
  });
});
