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
  await page.getByRole("link", { name: "Добавить в мой сад" }).click();
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

test("демо: лента — подписка, лайк, комментарий, свой пост и новое достижение", async ({ page }) => {
  const errors = trackErrors(page);
  await startDemo(page);
  await page.goto("/feed/");
  const annaPost = page.locator("article").filter({ hasText: "Седьмой резной лист" });
  await expect(annaPost).toBeVisible();

  await annaPost.getByRole("button", { name: "Нравится" }).click();
  await expect(annaPost.getByRole("button", { name: "Убрать лайк" })).toContainText("1,3 тыс.");

  await annaPost.getByRole("button", { name: "Комментарии" }).click();
  await expect(page.getByText("Какая красота! Чем подкармливаете?")).toBeVisible();
  await page.getByLabel("Текст комментария").fill("Потрясающе!");
  await page.getByRole("button", { name: "Отправить" }).click();
  await expect(page.getByText("Потрясающе!")).toBeVisible();
  await page.getByRole("button", { name: "Закрыть" }).click();
  await expect(annaPost.getByRole("button", { name: "Комментарии" })).toContainText("3");

  // Подписка из «Интересного» добавляет автора в «Подписки».
  await page.getByRole("tab", { name: "Интересное" }).click();
  await page.getByRole("button", { name: "Подписаться на fikus_papa" }).click();
  await expect(page.getByText("Вы подписались на fikus_papa")).toBeVisible();
  await page.getByRole("tab", { name: "Подписки" }).click();
  await expect(page.getByText("Год назад был черенком в стакане.")).toBeVisible();

  await page.getByRole("link", { name: "Новый пост" }).click();
  await page.getByLabel("Подпись").fill("Мой первый пост 🌱");
  await page.getByRole("button", { name: "Опубликовать" }).click();
  await page.waitForURL("**/feed/?tab=following");
  await expect(page.getByText("Мой первый пост 🌱")).toBeVisible();
  await expect(page.getByText("Новое достижение! «Звезда подоконника»")).toBeVisible();
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
  await expect(page.getByText("База знаний «Мой сад»").first()).toBeVisible();

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
