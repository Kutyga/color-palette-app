// Браузер проходит по сайту вошедшим пользователем (Алиса из дымового теста базы) и собирает
// ответы API с ошибками. Запуск: spaceweb/api/test/site-smoke.sh
import { createRequire } from "node:module";

const require = createRequire(new URL("../../../web/package.json", import.meta.url));
const { chromium } = require("playwright");
const SITE = process.env.SITE;

const browser = await chromium.launch();
const page = await browser.newPage();
const problems = [];
page.on("response", (r) => {
  if (r.url().includes("/api/") && r.status() >= 400) problems.push(`${r.status()} ${r.request().method()} ${r.url().replace(SITE, "")}`);
});
page.on("pageerror", (e) => problems.push(`JS: ${e.message}`));

await page.goto(`${SITE}/login/`);
await page.getByLabel("Почта").fill("alice@example.com");
await page.getByLabel("Пароль").fill("test-password");
await page.getByRole("button", { name: /войти/i }).click();
await page.waitForURL(/\/today\//, { timeout: 15000 });

const pages = ["/today/", "/garden/", "/plants/", "/feed/", "/messages/", "/profile/", "/people/", "/achievements/", "/shop/"];
for (const p of pages) {
  const res = await page.goto(`${SITE}${p}`);
  await page.waitForLoadState("networkidle");
  console.log(`${res?.status()} ${p}`);
}
// Растение Алисы из дымового теста — с графиком, вложениями и фото.
await page.goto(`${SITE}/garden/plant/?id=20000000-0000-0000-0000-000000000001`);
await page.waitForLoadState("networkidle");
console.log(`растение: ${(await page.locator("h1").first().textContent())?.trim()}`);

await browser.close();
if (problems.length) {
  console.log("Ошибки:\n" + [...new Set(problems)].join("\n"));
  process.exit(1);
}
console.log("site smoke: OK");
