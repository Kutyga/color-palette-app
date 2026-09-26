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
  expect(errors).toEqual([]);
});

test("демо: достижения и выход из демо-режима", async ({ page }) => {
  await startDemo(page);
  await page.goto("/achievements/");
  await expect(page.getByText("Росточек")).toBeVisible();
  await expect(page.getByText("Первый росток")).toBeVisible();
  await expect(page.getByText("Секрет").first()).toBeVisible();

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
  expect(errors).toEqual([]);
});
