/** Сквозные тесты сайта в демо-режиме: основные сценарии на телефоне и компьютере (Playwright). */

import { expect, test, type Page } from "@playwright/test";

/** Ошибки JavaScript на странице — повод уронить тест. */
function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function startDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Попробовать без регистрации" }).click();
  await page.waitForURL("**/today/");
}

test("гость: база знаний открыта всем, сад — только после входа", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/plants/");
  await page.getByRole("searchbox", { name: "Поиск по базе знаний" }).fill("калатея");
  await expect(page.getByText("Калатея круглолистная")).toBeVisible();
  await expect(page.getByText("Монстера деликатесная")).toHaveCount(0);

  // Опечатка всё равно находит вид.
  await page.getByRole("searchbox", { name: "Поиск по базе знаний" }).fill("монтсера");
  await expect(page.getByText("Монстера деликатесная")).toBeVisible();

  await page.getByRole("searchbox", { name: "Поиск по базе знаний" }).fill("");
  await page.getByRole("button", { name: "Безопасно для кошек" }).click();
  await expect(page.getByText("Хлорофитум хохлатый")).toBeVisible();
  await expect(page.getByText("Монстера деликатесная")).toHaveCount(0);

  await page.goto("/plants/goeppertia-orbifolia/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Калатея круглолистная");
  await expect(page.getByText("Прежние латинские названия: Calathea orbifolia")).toBeVisible();

  await page.goto("/today/");
  await page.waitForURL("**/login/**");
  await expect(page.getByRole("heading", { name: "С возвращением" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("демо: полив с экрана «Сегодня» закрывает задачу и продлевает серию", async ({ page }) => {
  const errors = trackErrors(page);
  await startDemo(page);
  await expect(page.getByRole("heading", { name: "Просрочено" })).toBeVisible();
  await expect(page.getByText("0 из 1 сделано")).toBeVisible();
  await expect(page.getByText("6 дней подряд")).toBeVisible();

  await page.getByRole("button", { name: "Полить: Монстера Мося" }).click();
  await expect(page.getByText("Полив: Монстера Мося — готово")).toBeVisible();
  await expect(page.getByText("На сегодня всё")).toBeVisible();
  await expect(page.getByText("7 дней подряд")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Просрочено" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("демо: добавить растение из базы знаний, полить, данные переживают перезагрузку", async ({ page }) => {
  const errors = trackErrors(page);
  await startDemo(page);
  await page.goto("/plants/hoya-carnosa/");
  await page.getByRole("link", { name: "Добавить в коллекцию" }).click();
  await page.waitForURL("**/garden/new/**");
  await expect(page.getByText("Хойя мясистая").first()).toBeVisible();
  await page.getByLabel("Имя").fill("Хойя Звёздочка");
  await page.getByRole("button", { name: "Сегодня", exact: true }).click();
  // Без снимка добавить нельзя, а выбрать файл из галереи негде — только камера.
  await expect(page.getByRole("button", { name: "Добавить в коллекцию" })).toBeDisabled();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Сфотографировать растение" }).click();
  await expect(page.getByRole("dialog", { name: "Камера" })).toBeVisible();
  await page.getByRole("button", { name: "Снять" }).click();
  await expect(page.getByRole("img", { name: "Фото растения" })).toHaveAttribute("src", /^blob:/);
  await page.getByRole("button", { name: "Добавить в коллекцию" }).click();

  await page.waitForURL("**/garden/plant/**");
  await expect(page.getByRole("heading", { name: "Хойя Звёздочка" })).toBeVisible();
  await expect(page.getByText("Хойя мясистая теперь в вашем саду").or(page.getByText("Хойя Звёздочка теперь в вашем саду"))).toBeVisible();
  // График из карточки вида: полив, подкормка, пересадка.
  await expect(page.getByText("Подкормка", { exact: true })).toBeVisible();
  await expect(page.getByText("Пересадка", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Полить" }).click();
  await expect(page.getByText("Полив: Хойя Звёздочка — готово")).toBeVisible();
  await expect(page.getByRole("list").filter({ hasText: "Полив" }).last()).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Хойя Звёздочка" })).toBeVisible();
  await expect(page.getByText("Пока пусто — отметьте первый полив.")).toHaveCount(0);

  await page.goto("/garden/");
  await expect(page.getByText("Хойя Звёздочка")).toBeVisible();
  await expect(page.getByText("5", { exact: true }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("демо: дневники — поддержка, комментарий, подписка, своя запись и достижение", async ({ page }) => {
  const errors = trackErrors(page);
  await startDemo(page);
  await page.goto("/feed/");
  const annaPost = page.locator("article").filter({ hasText: "Седьмой резной лист" });
  await expect(annaPost).toBeVisible();
  await expect(annaPost.getByText("Новый лист")).toBeVisible();

  await annaPost.getByRole("button", { name: "Поддержать" }).click();
  await expect(annaPost.getByRole("button", { name: "Убрать поддержку" })).toContainText("129");

  await annaPost.getByRole("button", { name: "Комментарии" }).click();
  await expect(page.getByText("Какая красота! Чем подкармливаете?")).toBeVisible();
  await page.getByLabel("Текст комментария").fill("Потрясающе!");
  await page.getByRole("button", { name: "Отправить" }).click();
  await expect(page.getByText("Потрясающе!")).toBeVisible();
  await page.getByRole("button", { name: "Закрыть" }).click();
  await expect(annaPost.getByRole("button", { name: "Комментарии" })).toContainText("3");

  // Подписка из «Все садоводы» добавляет автора в «Мои подписки».
  await page.getByRole("button", { name: "Все садоводы" }).click();
  await page.getByRole("button", { name: "Подписаться на Фикус Папа" }).click();
  await expect(page.getByText("Вы подписались на Фикус Папа")).toBeVisible();
  await page.getByRole("button", { name: "Мои подписки" }).click();
  await expect(page.getByText("Год назад был черенком в стакане.")).toBeVisible();

  // Своя запись: только своё растение и снимок с камеры.
  await page.getByRole("link", { name: "Запись" }).click();
  await expect(page.getByRole("button", { name: "Добавить в дневник" })).toBeDisabled();
  await page.getByRole("combobox", { name: /^Растение/ }).selectOption({ label: "Монстера Мося" });
  await page.getByRole("button", { name: "🌸 Цветение" }).click();
  await page.getByRole("button", { name: "Сфотографировать растение" }).click();
  await page.getByRole("button", { name: "Снять" }).click();
  await page.getByLabel("Пара слов").fill("Первый бутон 🌱");
  await page.getByRole("button", { name: "Добавить в дневник" }).click();
  await page.waitForURL("**/feed/?tab=diaries");
  const mine = page.locator("article").filter({ hasText: "Первый бутон 🌱" });
  await expect(mine.getByText("Цветение")).toBeVisible();
  await expect(page.getByText("Новое достижение! «Звезда подоконника»")).toBeVisible();

  // Дневник растения — все записи о нём по порядку.
  await mine.getByRole("link", { name: "Дневник растения" }).click();
  await expect(page.getByRole("heading", { name: "Дневник растения" })).toBeVisible();
  await expect(page.getByText("Монстера Мося").first()).toBeVisible();
  await expect(page.getByText("Первый бутон 🌱")).toBeVisible();
  expect(errors).toEqual([]);
});

test("демо: помощь — вопрос, ответ и лучший ответ", async ({ page }) => {
  const errors = trackErrors(page);
  await startDemo(page);
  await page.goto("/feed/?tab=help");
  // Сначала — вопросы без ответа.
  await expect(page.getByRole("link", { name: /Калатея сворачивает листья/ })).toContainText("Ждёт ответа");
  await page.getByRole("button", { name: "Все", exact: true }).click();
  await page.getByRole("link", { name: /У монстеры желтеют нижние листья/ }).click();
  await expect(page.getByText("Лучший ответ")).toBeVisible();
  await expect(page.getByText("Проверьте землю пальцем")).toBeVisible();
  await page.getByRole("link", { name: "Помощь" }).click();

  await page.getByRole("link", { name: "Спросить" }).click();
  await expect(page.getByRole("button", { name: "Спросить" })).toBeDisabled();
  await page.getByLabel("Вопрос").fill("Почему у щучки мягкие листья у основания?");
  await page.getByRole("button", { name: "Спросить" }).click();
  await page.waitForURL("**/feed/question/**");
  await expect(page.getByText("Ответов пока нет")).toBeVisible();
  await page.getByLabel("Текст ответа").fill("Скорее всего перелив — проверьте корни.");
  await page.getByRole("button", { name: "Отправить" }).click();
  await expect(page.getByText("Скорее всего перелив")).toBeVisible();
  // Свой ответ отметить лучшим нельзя — кнопка только у чужих.
  await expect(page.getByRole("button", { name: "Это лучший ответ" })).toHaveCount(0);
  await page.getByRole("link", { name: "Помощь" }).click();
  await page.getByRole("button", { name: "Мои вопросы" }).click();
  await expect(page.getByRole("link", { name: /мягкие листья у основания/ })).toContainText("1 ответ");

  // Свой вопрос: правка в течение часа и удаление.
  await page.getByRole("link", { name: /мягкие листья у основания/ }).click();
  await page.getByRole("button", { name: "Действия с публикацией" }).click();
  await expect(page.getByText(/Ещё \d+ минут/)).toBeVisible();
  await page.getByRole("button", { name: /Редактировать/ }).click();
  await page.getByLabel("Текст вопроса").fill("Почему у щучки мягкие и тёмные листья у основания?");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText("Почему у щучки мягкие и тёмные листья у основания?")).toBeVisible();
  await expect(page.getByText(/изменено/)).toBeVisible();
  await page.getByRole("button", { name: "Действия с публикацией" }).click();
  await page.getByRole("button", { name: "Удалить вопрос" }).click();
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  await page.waitForURL("**/feed/?tab=help");
  await page.getByRole("button", { name: "Мои вопросы" }).click();
  await expect(page.getByText("Вопросов пока нет")).toBeVisible();
  expect(errors).toEqual([]);
});

test("демо: барахолка — фильтры, чат с продавцом, своё объявление, блокировка", async ({ page }) => {
  const errors = trackErrors(page);
  await startDemo(page);
  await page.goto("/feed/?tab=market");
  // По умолчанию — город из профиля (в демо — Москва).
  await expect(page.getByRole("button", { name: "📍 Москва" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: /Укоренённая детка монстеры, 700/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Черенки хойи/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Все города" }).click();
  await expect(page.getByRole("link", { name: /Черенки хойи/ })).toBeVisible();
  await page.getByRole("button", { name: "🎁 Даром" }).click();
  await expect(page.getByRole("link", { name: /каланхоэ/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /детка монстеры/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Все", exact: true }).click();

  // Чат с продавцом: сообщение уходит, продавец (демо) отвечает.
  await page.getByRole("link", { name: /Укоренённая детка монстеры/ }).click();
  await page.getByRole("button", { name: "Написать продавцу" }).click();
  await page.waitForURL("**/messages/chat/**");
  await page.getByLabel("Текст сообщения").fill("Здравствуйте! Можно забрать завтра?");
  await page.getByRole("button", { name: "Отправить" }).click();
  await expect(page.getByText("Здравствуйте! Можно забрать завтра?")).toBeVisible();
  await expect(page.getByText("Здравствуйте! Да, ещё актуально")).toBeVisible();
  await page.getByRole("link", { name: "Сообщения" }).first().click();
  await expect(page.getByRole("link", { name: /Чат с Анна/ })).toContainText("Укоренённая детка монстеры");

  // Блокировка закрывает переписку.
  await page.getByRole("link", { name: /Чат с Анна/ }).click();
  await page.getByRole("button", { name: "Действия с чатом" }).click();
  await page.getByRole("button", { name: "Заблокировать" }).click();
  await page.getByRole("button", { name: "Заблокировать" }).last().click();
  await expect(page.getByText("Переписка закрыта: один из вас заблокировал другого.")).toBeVisible();

  // Своё объявление: фото из файлов (в объявлениях можно), цена, статус, удаление.
  await page.goto("/market/new/");
  await page.getByRole("button", { name: "🏷️ Продаю" }).click();
  await page.getByLabel("Название").fill("Детка хлорофитума");
  await page.getByLabel("Цена, ₽").fill("350");
  await page.getByRole("button", { name: "Опубликовать" }).click();
  await expect(page.getByText("Сфотографируйте растение")).toBeVisible();
  await page.getByLabel("Фото из файлов").setInputFiles("e2e/fixtures/plant.jpg");
  await expect(page.getByRole("img", { name: "Фото растения" })).toBeVisible();
  await page.getByRole("button", { name: "Опубликовать" }).click();
  await page.waitForURL("**/market/view/**");
  await expect(page.getByText("350 ₽")).toBeVisible();
  await expect(page.getByText("Это ваше объявление")).toBeVisible();
  await page.getByRole("button", { name: "Забронировано" }).click();
  await expect(page.getByText("Забронировано").first()).toBeVisible();
  await page.getByRole("button", { name: "Удалить объявление" }).click();
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  await page.waitForURL("**/feed/?tab=market");
  await page.getByRole("button", { name: "Мои" }).click();
  await expect(page.getByText("У вас пока нет объявлений")).toBeVisible();
  expect(errors).toEqual([]);
});

test("демо: растение в воде не просит полива; уведомления — после регистрации", async ({ page }) => {
  const errors = trackErrors(page);
  await startDemo(page);
  await page.goto("/today/");
  await expect(page.getByText("Монстера Мося").first()).toBeVisible();
  await page.goto("/garden/");
  await page
    .getByRole("link", { name: /Монстера Мося/ })
    .first()
    .click();
  await page.waitForURL("**/garden/plant/**");
  await expect(page.getByRole("button", { name: "Полить" })).toBeVisible();
  await page.getByRole("checkbox", { name: "Растёт в воде" }).check();
  await expect(page.getByText("не нужен — в воде")).toBeVisible();
  await expect(page.getByRole("button", { name: "Полить" })).toHaveCount(0);
  await page.goto("/garden/");
  await expect(page.getByText("💧 в воде")).toBeVisible();
  await page.goto("/profile/");
  await expect(page.getByText("Уведомления работают после регистрации.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("демо: место растения меняется, ошибочный полив удаляется из журнала", async ({ page }) => {
  const errors = trackErrors(page);
  await startDemo(page);
  await page.goto("/garden/");
  await page.getByRole("link", { name: /Щучка/ }).first().click();
  await page.waitForURL("**/garden/plant/**");
  await page.getByRole("button", { name: /Место: Кухня/ }).click();
  await page.getByRole("button", { name: /^Спальня/ }).click();
  await expect(page.getByRole("button", { name: /Место: Спальня/ })).toBeVisible();

  // Правка места: название и свет, затем удаление — растение остаётся без места.
  await page.getByRole("button", { name: /Место: Спальня/ }).click();
  await page.getByRole("button", { name: "Изменить место «Спальня»" }).click();
  const editor = page.getByRole("form", { name: "Изменить место «Спальня»" });
  await editor.getByLabel("Название места").fill("Детская");
  await editor.getByRole("button", { name: "Тень", exact: true }).click();
  await editor.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText("«Детская»: сохранено, сроки ухода пересчитаны под свет")).toBeVisible();
  await page.getByRole("button", { name: "Закрыть" }).click();
  await expect(page.getByRole("button", { name: /Место: Детская/ })).toBeVisible();
  await page.getByRole("button", { name: /Место: Детская/ }).click();
  await page.getByRole("button", { name: "Изменить место «Детская»" }).click();
  await page.getByRole("button", { name: "Удалить место" }).click();
  await expect(page.getByText("2 растения останутся без места.")).toBeVisible();
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(page.getByText("Место «Детская» удалено")).toBeVisible();
  await page.getByRole("button", { name: "Закрыть" }).click();
  await expect(page.getByRole("button", { name: /Место: не указано/ })).toBeVisible();

  const log = page.getByRole("list", { name: "Журнал ухода" }).getByRole("listitem").filter({ hasText: "Полив" });
  const before = await log.count();
  await page.getByRole("button", { name: "Полить" }).click();
  await expect(log).toHaveCount(before + 1);
  await log.first().getByRole("button", { name: "Удалить отметку «Полив»" }).click();
  await log.first().getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(page.getByText("Отметка «Полив» удалена")).toBeVisible();
  await expect(log).toHaveCount(before);
  expect(errors).toEqual([]);
});

test("демо: достижения и выход из демо-режима", async ({ page }) => {
  await startDemo(page);
  await page.goto("/achievements/");
  await expect(page.getByText("Росточек")).toBeVisible();
  await expect(page.getByText("Первый росток")).toBeVisible();
  await expect(page.getByText("Секрет").first()).toBeVisible();
  for (const section of ["Сад", "Сообщество", "Барахолка"]) await expect(page.getByRole("region", { name: section })).toBeVisible();
  await expect(page.getByRole("region", { name: "Магазин" })).toHaveCount(0);
  await expect(page.getByText("Откройте магазин — появятся награды магазина.")).toBeVisible();

  await page.goto("/profile/");
  await page.getByRole("button", { name: "Выйти из демо-режима" }).click();
  await page.waitForURL((url) => url.pathname.endsWith("/"));
  await page.goto("/garden/");
  await page.waitForURL("**/login/**");
});

test("демо: новости — выбор языка и чтение статьи на сайте", async ({ page }) => {
  const errors = trackErrors(page);
  await startDemo(page);
  await page.goto("/feed/?tab=news");
  await expect(page.getByText("База знаний «Подоконника»").first()).toBeVisible();

  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByText("Новостей пока нет")).toBeVisible();
  await page.getByRole("button", { name: "Все языки" }).click();

  await page.getByRole("button", { name: "Настройки новостей" }).click();
  await expect(page.getByText("Переводить автоматически")).toBeVisible();
  await page.getByRole("button", { name: "Закрыть" }).click();

  // Выбор языка запоминается.
  await page.getByRole("button", { name: "Русский" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Русский" })).toHaveAttribute("aria-pressed", "true");

  await page.goto("/feed/article/?id=unknown");
  await expect(page.getByText("Текст статьи здесь недоступен")).toBeVisible();
  expect(errors).toEqual([]);
});

test("гость: фото вида, состав грунта со схемой и справочник грунтов", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/plants/monstera-deliciosa/");
  await expect(page.getByRole("img", { name: "Монстера деликатесная" })).toHaveAttribute("src", /wikimedia\.org/);
  await expect(page.getByRole("link", { name: /Wikimedia Commons/ })).toHaveAttribute("href", /commons\.wikimedia\.org\/wiki\/File:/);

  const soil = page.locator("#soil");
  await expect(soil.getByRole("heading", { name: "Ароидный рыхлый" })).toBeVisible();
  await expect(soil.getByText("Для этого растения:")).toBeVisible();
  await expect(soil.getByRole("img", { name: /Разрез горшка: смесь, дренаж 2 см/ })).toBeVisible();
  // Калькулятор: 30% торфа в горшке на 5 л — 1,5 л.
  await soil.getByRole("button", { name: "5 л", exact: true }).click();
  await expect(soil.getByRole("button", { name: "5 л", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(soil.getByText(/1,5 л\s+торф/)).toBeVisible();

  await soil.getByRole("link", { name: "Все составы грунта →" }).click();
  await page.waitForURL("**/plants/soil/**");
  await expect(page.getByRole("heading", { level: 1, name: "Грунты" })).toBeVisible();
  const cactus = page.locator("#cactus_succulent");
  await expect(cactus.getByRole("img", { name: /мульча/ })).toBeVisible();
  await expect(cactus.getByRole("link", { name: "Алоэ вера" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("демо: редактирование профиля, подписчики, поиск садоводов и их растения", async ({ page }) => {
  const errors = trackErrors(page);
  await startDemo(page);
  await page.goto("/profile/");
  await expect(page.getByRole("heading", { level: 1, name: "Гость" })).toBeVisible();
  await expect(page.getByText("@gost")).toBeVisible();

  await page.getByRole("button", { name: "Редактировать профиль" }).click();
  await page.getByLabel("Имя", { exact: true }).fill("Макс Садовод");
  await page.getByLabel("Имя пользователя").fill("Max.Sad");
  await expect(page.getByLabel("Имя пользователя")).toHaveValue("max_sad");
  await page.getByLabel("О себе").fill("Фикусы и кактусы");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText("Профиль сохранён")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Макс Садовод" })).toBeVisible();
  await expect(page.getByText("@max_sad")).toBeVisible();
  await expect(page.getByText("Фикусы и кактусы")).toBeVisible();

  // Подписчики открываются списком.
  await page.getByRole("button", { name: /2\s+подписчика/ }).click();
  const followers = page.getByRole("dialog", { name: "Подписчики" });
  await expect(followers.getByText("Фикус Папа")).toBeVisible();
  await followers.getByRole("button", { name: "Закрыть" }).click();

  // Поиск садоводов → профиль → растения → подписка.
  await page.getByRole("link", { name: "Найти садоводов" }).click();
  await page.waitForURL("**/people/");
  await expect(page.getByText("Популярные садоводы")).toBeVisible();
  await page.getByRole("searchbox", { name: "Поиск садоводов" }).fill("свет");
  await page.getByRole("link", { name: /Света \| суккуленты/ }).click();
  await page.waitForURL("**/people/view/**");
  await expect(page.getByRole("heading", { level: 1, name: "Света | суккуленты" })).toBeVisible();
  await expect(page.getByText("Камешки")).toBeVisible();
  await expect(page.getByRole("link", { name: /Литопс/ })).toBeVisible();
  await page.getByRole("button", { name: "Подписаться на Света | суккуленты" }).click();
  await expect(page.getByRole("button", { name: "Отписаться от Света | суккуленты" })).toHaveText(/Вы подписаны/);
  await expect(page.getByText("Вы подписались на Света | суккуленты")).toBeVisible();

  // «Написать» из профиля → личный чат → ответ → в списке сообщений.
  await page.getByRole("button", { name: "Написать Света | суккуленты" }).click();
  await page.waitForURL("**/messages/chat/**");
  await expect(page.getByText("Личная переписка")).toBeVisible();
  await page.getByRole("textbox").fill("Привет! Как поливать литопсы?");
  await page.getByRole("button", { name: /Отправить/ }).click();
  await expect(page.getByText("Приятно познакомиться")).toBeVisible();
  await page.goto("/messages/");
  await expect(page.getByRole("link", { name: /Чат с Света \| суккуленты/ })).toContainText("Личная переписка");
  expect(errors).toEqual([]);
});

test("демо: магазины — «Где купить», «Хочу», витрина, заявка и загрузка прайса", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/plants/monstera-deliciosa/");
  await expect(page.getByText("чтобы увидеть цены проверенных магазинов")).toBeVisible();
  await startDemo(page);

  // «Где купить»: московский магазин первым, питерский — с доставкой.
  await page.goto("/plants/monstera-deliciosa/");
  const offers = page.getByRole("list", { name: "Предложения магазинов" }).getByRole("listitem");
  await expect(offers).toHaveCount(3);
  await expect(offers.first()).toContainText("Зелёная комната");
  await expect(offers.first()).toContainText("2 490 ₽");
  await expect(offers.last()).toContainText("Доставка из г. Санкт-Петербург");
  await page.getByRole("button", { name: "Хочу купить" }).click();
  await expect(page.getByRole("button", { name: "Хочу", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/profile/");
  await expect(page.getByRole("list", { name: "Хочу купить" })).toContainText("Монстера деликатесная");

  // Витрина из вкладки «Магазины».
  await page.goto("/feed/?tab=market");
  await page.getByRole("button", { name: "🏪 Магазины" }).click();
  await page.getByRole("link", { name: /Зелёная комната/ }).click();
  await page.waitForURL("**/shop/**");
  await expect(page.getByText("Проверенный магазин · Москва")).toBeVisible();
  const catalog = page.getByRole("list", { name: "Каталог" }).getByRole("listitem");
  await expect(catalog).toHaveCount(6);
  await page.getByLabel("Поиск по каталогу").fill("замио");
  await expect(catalog).toHaveCount(1);
  await expect(catalog.first()).toContainText("1 890 ₽");

  // Свой магазин: заявка с проверкой ИНН.
  await page.goto("/profile/");
  await page.getByRole("link", { name: /Вы продаёте растения/ }).click();
  await page.waitForURL("**/shop/manage/");
  await page.getByLabel("Название магазина").fill("Суккуленты у Гостя");
  await page.getByLabel(/^ИНН/).fill("12345");
  await page.getByLabel("Телефон").fill("+7 900 123-45-67");
  await page.getByRole("button", { name: "Отправить на проверку" }).click();
  await expect(page.getByText("Проверьте ИНН")).toBeVisible();
  await page.getByLabel(/^ИНН/).fill("");
  await page.getByRole("button", { name: "Отправить на проверку" }).click();
  await expect(page.getByText("На проверке")).toBeVisible();

  // Прайс в CSV из Excel: «;», вид определяется по названию, один — вручную.
  const csv =
    "Артикул;Наименование;Цена;Остаток\nA1;Монстера деликатесная 17/60;2 100;3\nA2;Филодендрон Глориозум;450;0\nA3;Кашпо белое 20 см;900;5\n";
  await page.getByLabel("Файл прайса").setInputFiles({ name: "price.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByRole("status")).toContainText("Готово к загрузке: 3 · вид определён у 1");
  await page.getByLabel("Вид для «Филодендрон Глориозум»").selectOption({ label: "Филодендрон лазящий (Philodendron hederaceum)" });
  await expect(page.getByRole("status")).toContainText("вид определён у 2");
  await page.getByRole("button", { name: "Загрузить 3 товара" }).click();
  await expect(page.getByText("Готово: новых 3, обновлено 0")).toBeVisible();
  const products = page.getByRole("list", { name: "Товары" }).getByRole("listitem");
  await expect(products).toHaveCount(3);
  await expect(products.filter({ hasText: "Филодендрон Глориозум" })).toContainText("Филодендрон лазящий");
  await expect(page.getByLabel("В наличии: Филодендрон Глориозум")).not.toBeChecked();
  await page.getByLabel("В наличии: Филодендрон Глориозум").check();
  await expect(page.getByLabel("В наличии: Филодендрон Глориозум")).toBeChecked();
  await page.getByRole("button", { name: "Удалить «Кашпо белое 20 см»" }).click();
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(products).toHaveCount(2);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Выгрузить" }).click();
  expect((await download).suggestedFilename()).toMatch(/^katalog-\d{4}-\d{2}-\d{2}\.csv$/);

  // Прайс из Excel (.xlsx) дополняет каталог по артикулу.
  await page.getByLabel("Файл прайса").setInputFiles("e2e/fixtures/price.xlsx");
  await expect(page.getByRole("status")).toContainText("Готово к загрузке: 2 · вид определён у 2");
  await page.getByRole("button", { name: "Загрузить 2 товара" }).click();
  await expect(products).toHaveCount(4);
  await expect(page.getByLabel("В наличии: Фикус лировидный")).not.toBeChecked();

  // Появились награды магазина.
  await page.goto("/achievements/");
  const shopSection = page.getByRole("region", { name: "Магазин" });
  await expect(shopSection).toContainText("Открываем двери");
  await expect(shopSection).toContainText("1 из 7");

  // Пока магазин не проверен, его нет в «Где купить».
  await page.goto("/plants/monstera-deliciosa/");
  await expect(offers).toHaveCount(3);

  // Свой магазин можно удалить — с подтверждением, вместе с каталогом.
  await page.goto("/shop/manage/");
  await page.getByRole("button", { name: "Удалить магазин" }).click();
  await page.getByRole("button", { name: "Отмена" }).click();
  await expect(page.getByText("Суккуленты у Гостя")).toBeVisible();
  await page.getByRole("button", { name: "Удалить магазин" }).click();
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(page.getByText("Магазин удалён")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Заявка" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("демо: «Что с растением?» — симптомы, причины и советы; фото — после регистрации", async ({ page }) => {
  const errors = trackErrors(page);
  await startDemo(page);
  await page.goto("/garden/");
  await page
    .getByRole("link", { name: /Калатея Ося/ })
    .first()
    .click();
  await page.waitForURL("**/garden/plant/**");
  await page.getByRole("link", { name: /Проверить болезни/ }).click();
  await page.waitForURL("**/garden/diagnose/**");
  await expect(page.getByText("Растение: Калатея Ося")).toBeVisible();
  await expect(page.getByText("Распознавание болезней по фото работает после регистрации.")).toBeVisible();
  await page.getByRole("button", { name: "Тонкая паутинка, мелкие светлые точки на листьях" }).click();
  await page.getByRole("button", { name: "Листья скручиваются" }).click();
  const causes = page
    .getByRole("list", { name: "Вероятные причины" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading") });
  await expect(causes.first()).toContainText("Паутинный клещ");
  await expect(causes.first()).toContainText("Действуйте сегодня");
  await expect(causes.first()).toContainText("Совпадает симптомов: 2 из 2");
  await page.getByRole("link", { name: "Спросить" }).click();
  await page.waitForURL("**/feed/new/**type=question**");
  expect(errors).toEqual([]);
});

test("демо: розыгрыши — закреплённый конкурс, участие, проверка честности, свой розыгрыш", async ({ page }) => {
  const errors = trackErrors(page);
  await startDemo(page);
  await page.goto("/feed/?tab=market");
  // Закреплённый конкурс «Подоконника» виден над объявлениями.
  await expect(page.getByRole("link", { name: /Закреплённый розыгрыш: Осенний розыгрыш/ })).toBeVisible();

  await page.getByRole("button", { name: "🎉 Конкурсы" }).click();
  const list = page.getByRole("list", { name: "Розыгрыши" });
  await expect(list.getByRole("link").first()).toContainText("Осенний розыгрыш");
  await list.getByRole("link", { name: /Черенок монстеры/ }).click();
  await page.waitForURL("**/market/contest/**");
  await page.getByRole("button", { name: "Участвую" }).click();
  await expect(page.getByText("Вы участвуете — удачи! 🍀")).toBeVisible();
  await expect(page.getByRole("button", { name: "Не участвовать" })).toBeVisible();
  await expect(page.getByText("Отпечаток секрета (SHA-256)")).toBeVisible();

  // Законченный розыгрыш: секрет раскрыт, итоги пересчитываются в браузере.
  await page.goto("/market/contest/?id=demo-contest-aloe");
  await expect(page.getByRole("heading", { name: "Победители" })).toBeVisible();
  await expect(page.getByText(/ждём ответа до/)).toBeVisible(); // у победителя 72 часа на подтверждение
  await page.getByRole("button", { name: "Проверить итоги" }).click();
  await expect(page.getByText("Проверено: секрет совпадает с отпечатком, победители посчитаны верно")).toBeVisible();

  // Свой розыгрыш.
  await page.goto("/market/contest/new/");
  await page.getByLabel("Название").fill("Детка хойи");
  await page.getByLabel("Приз", { exact: true }).fill("Хойя керри в горшке 7 см");
  await page.getByRole("button", { name: "Начать розыгрыш" }).click();
  await page.waitForURL("**/market/contest/?id=**");
  await expect(page.getByRole("heading", { name: "Детка хойи" })).toBeVisible();
  await expect(page.getByText("Это ваш розыгрыш")).toBeVisible();
  await page.getByRole("button", { name: "Отменить розыгрыш" }).click();
  await expect(page.getByText("Розыгрыш отменён")).toBeVisible();
  expect(errors).toEqual([]);
});

test("телефон: подсказка «на экран Домой» — один раз", async ({ page, isMobile }) => {
  test.skip(!isMobile, "подсказка только на телефоне");
  // Подсказка прячется от автотестов; здесь проверяем именно её.
  await page.addInitScript(() => Object.defineProperty(navigator, "webdriver", { get: () => false }));
  await page.goto("/plants/");
  const hint = page.getByRole("dialog", { name: "Подоконник на экране Домой" });
  await expect(hint).toBeVisible({ timeout: 10_000 });
  await hint.getByRole("tab", { name: "iPhone" }).click();
  await expect(hint.getByText("Пролистайте и выберите")).toBeVisible();
  await hint.getByRole("tab", { name: "Android" }).click();
  await expect(hint.getByText("Нажмите меню ⋮")).toBeVisible();
  await hint.getByRole("button", { name: "Понятно" }).click();
  await expect(hint).toBeHidden();

  await page.reload();
  await page.waitForTimeout(3500);
  await expect(hint).toBeHidden();
});

test("вход: ссылка «Забыли пароль?» переключает на восстановление", async ({ page }) => {
  await page.goto("/login/");
  test.skip(!(await page.getByRole("button", { name: "Забыли пароль?" }).count()), "сборка без сервера — только демо");
  await page.getByRole("button", { name: "Забыли пароль?" }).click();
  await expect(page.getByRole("heading", { name: "Восстановить пароль" })).toBeVisible();
  await expect(page.getByLabel("Пароль")).toHaveCount(0);
});

test("розыгрыш «Подоконника»: приглашение на «Сегодня», скрывается крестиком", async ({ page }) => {
  await startDemo(page);
  const promo = page.getByRole("region", { name: "Розыгрыш" });
  await expect(promo).toBeVisible();
  await promo.getByRole("button", { name: "Скрыть розыгрыш" }).click();
  await expect(promo).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("0 из", { exact: false }).first()).toBeVisible();
  await expect(promo).toHaveCount(0);
});
