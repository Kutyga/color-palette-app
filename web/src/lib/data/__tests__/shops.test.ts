import { describe, expect, it } from "vitest";
import { demoBackend, memoryDemoStorage, type DemoState, type DemoStorage } from "../demo-backend";
import { SpeciesIds } from "../supabase-backend";
import {
  TEMPLATE_CSV,
  INN_REQUIRED,
  guessMapping,
  isValidInn,
  parseCsv,
  parseInStock,
  parseNumber,
  productsToCsv,
  rowsToProducts,
  slugifyTitle,
  speciesMatcher,
  validateShop,
  emptyShopDraft,
  withUtm,
  type ShopDraft,
} from "../../domain/shop";
import { ALL_SPECIES, speciesById } from "../../knowledge";

const clock = () => new Date(2026, 6, 15, 12);
const match = speciesMatcher(ALL_SPECIES);

describe("анкета магазина", () => {
  it("ИНН: контрольные цифры организаций и ИП", () => {
    expect(isValidInn("7707083893")).toBe(true);
    expect(isValidInn("7736207543")).toBe(true);
    expect(isValidInn("500100732259")).toBe(true);
    expect(isValidInn("7707083894")).toBe(false);
    expect(isValidInn("500100732258")).toBe(false);
    expect(isValidInn("12345")).toBe(false);
  });

  it("нужен хотя бы один способ связи, сайт дополняется https://", () => {
    const d: ShopDraft = { ...emptyShopDraft("Казань"), name: "Кактус", inn: "7707083893" };
    expect(validateShop(d)?.field).toBe("phone");
    expect(validateShop({ ...d, website: "kaktus.ru" })).toBeNull();
    expect(validateShop({ ...d, website: "не сайт" })?.field).toBe("website");
    expect(validateShop({ ...d, phone: "+7 (843) 200-00-00" })).toBeNull();
    // Проверка ИНН временно отключена: пустой и «неправильный по контрольным цифрам» проходят.
    expect(INN_REQUIRED).toBe(false);
    expect(validateShop({ ...d, inn: "", phone: "+7 843 200-00-00" })).toBeNull();
    expect(validateShop({ ...d, inn: "1234567890", phone: "+7 843 200-00-00" })).toBeNull();
    expect(validateShop({ ...d, inn: "12345", phone: "+7 843 200-00-00" })?.field).toBe("inn");
  });

  it("UTM-метки не затирают свои", () => {
    expect(withUtm("https://shop.ru/p/1?x=1", "where_to_buy")).toBe(
      "https://shop.ru/p/1?x=1&utm_source=podokonnik&utm_medium=referral&utm_campaign=where_to_buy",
    );
    expect(withUtm("https://shop.ru/?utm_source=my", "storefront")).toBe("https://shop.ru/?utm_source=my");
  });
});

describe("импорт каталога", () => {
  it("CSV из Excel: «;», BOM, кавычки и перенос внутри ячейки", () => {
    const rows = parseCsv('﻿Артикул;Название;Цена\r\nA1;"Фикус ""Робуста""";1 290,00 ₽\r\n\r\nA2;"Две\nстроки";990\r\n');
    expect(rows).toEqual([
      ["Артикул", "Название", "Цена"],
      ["A1", 'Фикус "Робуста"', "1 290,00 ₽"],
      ["A2", "Две\nстроки", "990"],
    ]);
    expect(parseCsv("sku,title\n1,Monstera")).toEqual([["sku", "title"], ["1", "Monstera"]]);
  });

  it("числа и наличие в любом виде", () => {
    expect(parseNumber("1 290,50 ₽")).toBe(1290.5);
    expect(parseNumber("990 руб.")).toBe(990);
    expect(parseNumber(12)).toBe(12);
    expect(parseNumber("по запросу")).toBeNull();
    expect(parseInStock("да")).toBe(true);
    expect(parseInStock("нет")).toBe(false);
    expect(parseInStock(0)).toBe(false);
    expect(parseInStock("5")).toBe(true);
    expect(parseInStock("под заказ")).toBe(false);
    expect(parseInStock("")).toBe(true);
  });

  it("колонки угадываются по заголовкам", () => {
    const m = guessMapping(["Код", "Наименование", "Розничная цена", "Остаток", "Ссылка", "Что-то ещё"]);
    expect(m).toMatchObject({ externalId: 0, title: 1, priceRub: 2, inStock: 3, url: 4, species: null, potCm: null });
  });

  it("вид ищется по латыни, потом по самому длинному русскому названию", () => {
    expect(match("Monstera deliciosa Thai Constellation 24/100")?.slug).toBe("monstera-deliciosa");
    expect(match("Монстера деликатесная 17/60")?.slug).toBe("monstera-deliciosa");
    expect(match("Замиокулькас 17/60")?.slug).toBe("zamioculcas-zamiifolia");
    expect(match("Грунт для орхидей 2 л")).toBeNull();
    expect(match("Кашпо Монстр 20 см")).toBeNull(); // «монстр» — не монстера
  });

  it("шаблон загружается сам в себя без ошибок", () => {
    const [header, ...rows] = parseCsv(TEMPLATE_CSV);
    const parsed = rowsToProducts(rows, guessMapping(header), match);
    expect(parsed.map((p) => p.error)).toEqual([null, null, null]);
    expect(parsed[0]).toMatchObject({ externalId: "MON-24", speciesId: "monstera-deliciosa", priceRub: 3490, inStock: true, potCm: 24, heightCm: 100 });
    expect(parsed[1]).toMatchObject({ speciesId: "zamioculcas-zamiifolia", inStock: true });
    expect(parsed[2]).toMatchObject({ speciesId: "goeppertia-orbifolia", inStock: false });
  });

  it("ошибочные строки помечаются, мусорные ссылки отбрасываются", () => {
    const m = guessMapping(["Артикул", "Название", "Цена", "Ссылка", "Фото"]);
    const parsed = rowsToProducts(
      [
        ["", "Монстера деликатесная", "0", "", ""],
        ["X", "", "100", "", ""],
        ["Y", "Фикус", "100", "shop.ru/ficus", "http://img.ru/1.jpg"],
        ["Y", "Фикус 2", "100", "", ""],
      ],
      m,
      match,
    );
    expect(parsed.map((p) => p.error)).toEqual(["Цена вне диапазона", "Нет названия", null, "Артикул повторяется"]);
    expect(parsed[0].externalId).toBe(slugifyTitle("Монстера деликатесная"));
    expect(parsed[2]).toMatchObject({ url: null, imageUrl: null });
    expect(parsed[3].line).toBe(5);
  });

  it("выгрузка читается обратно тем же импортом", () => {
    const csv = productsToCsv(
      [{ id: "1", externalId: "A;1", title: 'Фикус "Робуста"', speciesId: "ficus-elastica", priceRub: 3290, inStock: false, potCm: 21, heightCm: 90, url: null, imageUrl: null }],
      (id) => speciesById(id)?.latinName ?? null,
    );
    const [header, ...rows] = parseCsv(csv);
    const [p] = rowsToProducts(rows, guessMapping(header), match);
    expect(p).toMatchObject({ externalId: "A;1", title: 'Фикус "Робуста"', speciesId: "ficus-elastica", priceRub: 3290, inStock: false });
  });
});

describe("магазины в демо-режиме", () => {
  const draft: ShopDraft = { ...emptyShopDraft("Москва"), name: "Мой магазин", inn: "500100732259", phone: "+7 900 000-00-00" };

  it("«Где купить»: свой город первым, чужой — только с доставкой, по цене", async () => {
    const b = await demoBackend(memoryDemoStorage(), clock);
    const offers = await b.shops.whereToBuy("monstera-deliciosa", "Москва");
    expect(offers.map((o) => [o.shopName, o.priceRub, o.sameCity])).toEqual([
      ["Зелёная комната", 2490, true],
      ["Зелёная комната", 4990, true],
      ["Ботаника на Литейном", 1590, false],
    ]);
    expect(await b.shops.whereToBuy("goeppertia-orbifolia", "Москва")).toHaveLength(1); // питерский, с доставкой
    expect((await b.shops.shops("Санкт-Петербург"))[0].name).toBe("Ботаника на Литейном");
  });

  it("заявка — на проверке и не видна в «Где купить»; импорт обновляет по артикулу", async () => {
    const b = await demoBackend(memoryDemoStorage(), clock);
    const shop = await b.shops.saveShop(draft);
    expect(shop).toMatchObject({ status: "pending", mine: true });
    await expect(b.shops.saveShop({ ...draft, inn: "12345" })).rejects.toThrow(/ИНН/);
    expect((await b.shops.saveShop({ ...draft, inn: "" })).inn).toBeNull();

    const row = { externalId: "M1", title: "Монстера", speciesId: "monstera-deliciosa", priceRub: 100, inStock: true, potCm: null, heightCm: null, url: null, imageUrl: null };
    expect(await b.shops.importProducts([row, { ...row, externalId: "M2" }], false)).toEqual({ inserted: 2, updated: 0, deleted: 0 });
    expect(await b.shops.importProducts([{ ...row, priceRub: 90 }], true)).toEqual({ inserted: 0, updated: 1, deleted: 1 });
    const products = await b.shops.products(shop.id);
    expect(products.map((p) => [p.externalId, p.priceRub])).toEqual([["M1", 90]]);
    expect((await b.shops.whereToBuy("monstera-deliciosa", "Москва")).some((o) => o.shopId === shop.id)).toBe(false);

    await b.shops.setInStock(products[0].id, false);
    expect((await b.shops.products(shop.id))[0].inStock).toBe(false);
    await b.shops.deleteProduct(products[0].id);
    expect(await b.shops.products(shop.id)).toEqual([]);
    await expect(b.shops.reviewQueue()).rejects.toThrow(/администратора/);
  });

  it("администратор подтверждает; смена названия — снова на проверку", async () => {
    let saved: DemoState | null = null;
    const storage: DemoStorage = { load: () => saved, save: (s) => void (saved = structuredClone(s)) };
    const b0 = await demoBackend(storage, clock);
    const shop = await b0.shops.saveShop(draft);
    saved!.profile = { username: "gost", displayName: "Гость", bio: null, city: "Москва", isAdmin: true };
    const b = await demoBackend(storage, clock);
    expect((await b.shops.reviewQueue())[0]).toMatchObject({ id: shop.id, status: "pending" });
    await b.shops.review(shop.id, "verified", "");
    await b.shops.importProducts(
      [{ externalId: "M1", title: "Монстера", speciesId: "monstera-deliciosa", priceRub: 100, inStock: true, potCm: null, heightCm: null, url: null, imageUrl: null }],
      false,
    );
    expect((await b.shops.whereToBuy("monstera-deliciosa", "Москва"))[0]).toMatchObject({ shopId: shop.id, priceRub: 100 });
    expect((await b.shops.saveShop({ ...draft, name: "Новое имя" })).status).toBe("pending");
  });

  it("список «Хочу»", async () => {
    const b = await demoBackend(memoryDemoStorage(), clock);
    await b.wishlist.set("ficus-lyrata", true);
    await b.wishlist.set("hoya-carnosa", true);
    await b.wishlist.set("ficus-lyrata", false);
    expect(await b.wishlist.list()).toEqual(["hoya-carnosa"]);
  });
});

describe("id видов в Supabase", () => {
  it("slug ↔ uuid, справочник грузится один раз", async () => {
    let calls = 0;
    const db = {
      from: () => ({
        select: async () => {
          calls++;
          return { data: [{ id: "u-1", slug: "monstera-deliciosa" }], error: null };
        },
      }),
    };
    const ids = new SpeciesIds(db as never);
    const [slugOf, uuidOf] = await Promise.all([ids.slugs(), ids.uuids()]);
    expect(slugOf("u-1")).toBe("monstera-deliciosa");
    expect(uuidOf("monstera-deliciosa")).toBe("u-1");
    expect(uuidOf("nope")).toBeNull();
    expect(slugOf(null)).toBeNull();
    expect(calls).toBe(1);
  });
});
