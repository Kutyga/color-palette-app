/**
 * Заполнение демо-режима стартовыми данными, чтобы экраны не были пустыми.
 */
import { ALL_SPECIES } from "../../knowledge";
import { DAY_MS, HOUR_MS } from "../../time";
import { SAMPLE_DIARIES, SAMPLE_LISTINGS, SAMPLE_PRODUCTS, SAMPLE_QUESTIONS, SAMPLE_SHOPS, demoId } from "./fixtures";
import { DemoGarden } from "./garden";
import type { DemoState } from "./state";

/** Магазины досеиваются и в старые демо-данные. */
export function seedShops(state: DemoState, now: Date) {
  if (state.shops) return;
  state.shops = SAMPLE_SHOPS.map(([name, inn, city, address, phone, website, delivery, description], i) => ({
    id: `demo-shop-${i}`,
    ownerId: `demo-shop-owner-${i}`,
    name,
    description,
    inn,
    city,
    address,
    hours: "Ежедневно 10:00–21:00",
    phone,
    website,
    delivery,
    status: "verified" as const,
    reviewNote: null,
    createdAt: new Date(now.getTime() - (30 + i) * DAY_MS).toISOString(),
    verifiedAt: new Date(now.getTime() - (29 + i) * DAY_MS).toISOString(),
  }));
  state.products = {};
  for (const [shop, externalId, title, slug, priceRub, potCm, heightCm] of SAMPLE_PRODUCTS) {
    (state.products[`demo-shop-${shop}`] ??= []).push({
      id: `demo-product-${shop}-${externalId}`,
      externalId,
      title,
      speciesId: ALL_SPECIES.find((s) => s.slug === slug)?.id ?? null,
      priceRub,
      inStock: true,
      potCm,
      heightCm,
      url: `${SAMPLE_SHOPS[shop][5]}/${externalId.toLowerCase()}`,
      imageUrl: null,
    });
  }
}

/** Стартовые данные, чтобы экраны демо-режима не были пустыми. */
export async function seedDemo(state: DemoState, clock: () => Date = () => new Date()) {
  const garden = new DemoGarden(state, () => {}, clock);
  const now = clock();
  const ago = (days: number, hour = 10) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, hour);
  const room = await garden.addLocation("Гостиная", "bright_indirect");
  const kitchen = await garden.addLocation("Кухня", "medium");
  const bedroom = await garden.addLocation("Спальня", "medium");
  const mosya = await garden.addPlant({
    nickname: "Монстера Мося",
    speciesSlug: "monstera-deliciosa",
    locationId: room.id,
    potMaterial: "plastic",
    lastWateredAt: ago(11),
  });
  const shchuchka = await garden.addPlant({
    nickname: "Щучка",
    speciesSlug: "dracaena-trifasciata",
    locationId: kitchen.id,
    potMaterial: "ceramic",
  });
  const robert = await garden.addPlant({
    nickname: "Фикус Роберт",
    speciesSlug: "ficus-elastica",
    locationId: room.id,
    potMaterial: "ceramic",
  });
  const osya = await garden.addPlant({
    nickname: "Калатея Ося",
    speciesSlug: "goeppertia-orbifolia",
    locationId: bedroom.id,
    potMaterial: "plastic",
  });
  // Неделя ухода: серия дней и журнал в карточках.
  await garden.logCare(shchuchka.id, "water", { performedAt: ago(6) });
  await garden.logCare(robert.id, "water", { performedAt: ago(5) });
  await garden.logCare(osya.id, "water", { performedAt: ago(4, 9) });
  await garden.logCare(mosya.id, "fertilize", { performedAt: ago(3) });
  await garden.logCare(osya.id, "mist", { performedAt: ago(2, 7) });
  await garden.logCare(robert.id, "fertilize", { performedAt: ago(1, 19) });

  const hours = (h: number) => new Date(now.getTime() - h * HOUR_MS).toISOString();
  const speciesId = (slug: string) => ALL_SPECIES.find((s) => s.slug === slug)?.id ?? null;
  SAMPLE_DIARIES.forEach(([author, plant, slug, event, text, likes], i) => {
    const id = `demo-post-${i}`;
    state.posts.push({
      id,
      kind: "diary",
      event,
      speciesId: speciesId(slug),
      solvedCommentId: null,
      authorId: demoId(author),
      authorName: author,
      text,
      createdAt: hours(3 + i * 7),
      plantId: null,
      plantName: plant,
      photoUrl: null,
      likeCount: likes,
      commentCount: 2,
      likedByMe: false,
    });
    state.comments.push(
      {
        id: `${id}-c1`,
        postId: id,
        authorName: "fikus_papa",
        text: "Какая красота! Чем подкармливаете?",
        createdAt: hours(2),
        mine: false,
      },
      { id: `${id}-c2`, postId: id, authorName: "succulove", text: "Сохранила себе в вишлист 🌿", createdAt: hours(0.7), mine: false },
    );
  });
  SAMPLE_QUESTIONS.forEach(([author, slug, text, answers, best], i) => {
    const id = `demo-question-${i}`;
    state.posts.push({
      id,
      kind: "question",
      event: null,
      speciesId: speciesId(slug),
      solvedCommentId: best === null ? null : `${id}-a${best}`,
      authorId: demoId(author),
      authorName: author,
      text,
      createdAt: hours(5 + i * 9),
      plantId: null,
      plantName: null,
      photoUrl: null,
      likeCount: 0,
      commentCount: answers.length,
      likedByMe: false,
    });
    answers.forEach(([who, answer], j) =>
      state.comments.push({ id: `${id}-a${j}`, postId: id, authorName: who, text: answer, createdAt: hours(4 + i * 9 - j), mine: false }),
    );
  });
}

/** Объявления в «Барахолке» — досеиваются и в старые демо-данные. */
export function seedListings(state: DemoState, now: Date) {
  if (state.listings) return;
  state.listings = SAMPLE_LISTINGS.map(([author, kind, slug, title, description, priceRub, swapFor, city, delivery], i) => ({
    id: `demo-listing-${i}`,
    sellerId: demoId(author),
    kind,
    speciesSlug: slug,
    title,
    description,
    priceRub,
    swapFor,
    city,
    delivery,
    photoUrl: null,
    status: "active" as const,
    createdAt: new Date(now.getTime() - (2 + i * 5) * HOUR_MS).toISOString(),
  }));
}
