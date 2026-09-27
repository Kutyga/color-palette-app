import { describe, expect, it } from "vitest";
import { priceLabel, sameCity, validateListing, type ListingDraft } from "../../domain/market";
import { demoBackend, memoryDemoStorage } from "../demo";
import { DemoChat } from "../demo/chat";

const clock = () => new Date(2026, 6, 15, 12);
const draft = (patch: Partial<ListingDraft> = {}): ListingDraft => ({
  kind: "sell",
  title: "Детка монстеры",
  description: "",
  speciesId: null,
  priceRub: 500,
  swapFor: "",
  city: "Москва",
  delivery: false,
  photo: new Blob(["jpeg"], { type: "image/jpeg" }),
  ...patch,
});

describe("объявления: правила формы", () => {
  it("цена обязательна для «Продаю», фото — для всех, кроме «Ищу»", () => {
    expect(validateListing(draft(), true)).toBeNull();
    expect(validateListing(draft({ priceRub: null }), true)?.field).toBe("priceRub");
    expect(validateListing(draft({ kind: "free", priceRub: null }), false)?.field).toBe("photo");
    expect(validateListing(draft({ kind: "wanted", priceRub: null }), false)).toBeNull();
    expect(validateListing(draft({ city: " " }), true)?.field).toBe("city");
    expect(validateListing(draft({ title: "ab" }), true)?.field).toBe("title");
  });

  it("подписи цены и сравнение городов", () => {
    expect(priceLabel({ kind: "sell", priceRub: 1500 })).toMatch(/^1\s500 ₽$/);
    expect(priceLabel({ kind: "free", priceRub: null })).toBe("Даром");
    expect(sameCity(" казань", "Казань")).toBe(true);
    expect(sameCity("Орёл", "орел")).toBe(true);
    expect(sameCity("Москва", null)).toBe(false);
  });
});

describe("демо: барахолка и сообщения", () => {
  it("фильтры, своё объявление и его статусы", async () => {
    const b = await demoBackend(memoryDemoStorage(), clock);
    expect((await b.market.listings({ kind: "all", city: "Москва", deliveryOnly: false })).length).toBe(4);
    expect((await b.market.listings({ kind: "all", city: null, deliveryOnly: true })).map((l) => l.city).sort()).toEqual([
      "Казань",
      "Москва",
    ]);
    expect((await b.market.listings({ kind: "free", city: null, deliveryOnly: false }))[0].title).toMatch(/каланхоэ/);

    // «Ищу» — без фото (в Node нет FileReader для снимка).
    const mine = await b.market.createListing(draft({ kind: "wanted", priceRub: 900, swapFor: "лишнее", photo: null }));
    expect(mine).toMatchObject({ mine: true, kind: "wanted", priceRub: null, swapFor: null, city: "Москва" });
    await expect(b.chat.start(mine.id)).rejects.toThrow(/ваше/);
    await b.market.setStatus(mine.id, "closed");
    expect((await b.market.listings({ kind: "wanted", city: null, deliveryOnly: false })).some((l) => l.id === mine.id)).toBe(false);
    expect((await b.market.myListings()).find((l) => l.id === mine.id)?.status).toBe("closed");
    await b.market.deleteListing(mine.id);
    expect(await b.market.listing(mine.id)).toBeNull();
  });

  it("чат по объявлению: ответ продавца, непрочитанное, блокировка", async () => {
    const storage = memoryDemoStorage();
    await demoBackend(storage, clock);
    const state = storage.load()!;
    const chat = new DemoChat(state, () => {}, clock, 0);
    const convId = await chat.start("demo-listing-0");
    expect(await chat.start("demo-listing-0")).toBe(convId);

    const incoming: string[] = [];
    const stop = chat.subscribe(convId, (m) => incoming.push(m.body));
    await chat.send(convId, "Здравствуйте! Ещё продаёте?");
    await new Promise((r) => setTimeout(r, 5));
    stop();
    expect(incoming).toHaveLength(1);
    expect((await chat.messages(convId)).map((m) => m.mine)).toEqual([true, false]);

    let [conv] = await chat.conversations();
    expect(conv).toMatchObject({ unread: true, otherDisplayName: "Анна", listingTitle: "Укоренённая детка монстеры" });
    await chat.markRead(convId);
    [conv] = await chat.conversations();
    expect(conv.unread).toBe(false);

    await chat.block(conv.otherId);
    [conv] = await chat.conversations();
    expect(conv.blocked).toBe(true);
    await expect(chat.send(convId, "Ау?")).rejects.toThrow();
  });
});
