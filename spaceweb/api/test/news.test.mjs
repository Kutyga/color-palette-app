// Разбор лент и «режим чтения» на PHP (lib/News.php) — на тех же примерах, что и у функций Supabase.
// Запуск: node spaceweb/api/test/news.test.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";

const lib = new URL("../lib/News.php", import.meta.url).pathname;
const php = (code, input) =>
  JSON.parse(execFileSync("php", ["-r", `require '${lib}'; $in = stream_get_contents(STDIN); ${code}`], { input, encoding: "utf8" }));

test("RSS и Atom: заголовок, ссылка, описание, картинка, дата", () => {
  const rss = `<rss><channel><item><title><![CDATA[Монстера &laquo;зацвела&raquo;]]></title>
    <link>https://example.com/a</link><description>&lt;p&gt;Редкий случай: &lt;img src="https://example.com/i.jpg"&gt; цветок&lt;/p&gt;</description>
    <pubDate>Mon, 28 Sep 2026 10:00:00 GMT</pubDate></item>
    <item><title>Без ссылки</title></item></channel></rss>`;
  const [a, ...rest] = php("echo json_encode(News::parseFeed($in), JSON_UNESCAPED_UNICODE);", rss);
  assert.equal(rest.length, 0, "запись без ссылки пропущена");
  assert.equal(a.title, "Монстера «зацвела»");
  assert.equal(a.url, "https://example.com/a");
  assert.equal(a.summary, "Редкий случай: цветок");
  assert.equal(a.image_url, "https://example.com/i.jpg");
  assert.equal(a.published_at, "2026-09-28T10:00:00.000Z");

  const atom = `<feed><entry><title>Fern news</title><link rel="alternate" href="https://example.org/f"/><summary>moss</summary>
    <updated>2026-09-01T00:00:00Z</updated></entry></feed>`;
  const [b] = php("echo json_encode(News::parseFeed($in));", atom);
  assert.equal(b.url, "https://example.org/f");
  assert.ok(php("echo json_encode(News::isAboutPlants(News::parseFeed($in)[0]));", atom), "про растения");
});

test("режим чтения: основной текст без меню и скриптов, картинки — абсолютными ссылками", () => {
  const long = "Полив монстеры зависит от света и сезона. ".repeat(12);
  const html = `<html lang="ru"><head><title>Как поливать</title><meta property="og:site_name" content="Сад"></head><body>
    <nav><p>Меню сайта ${long}</p></nav><script>alert(1)</script>
    <article><h1>Как поливать</h1><p>${long}</p><p><img src="/img/m.jpg" alt="Монстера">Подпись</p>
    <ul><li>Летом — чаще</li></ul><blockquote>Цитата</blockquote></article></body></html>`;
  const a = php("echo json_encode(News::extractArticle($in, 'https://example.com/post/1'), JSON_UNESCAPED_UNICODE);", html);
  assert.equal(a.lang, "ru");
  assert.equal(a.siteName, "Сад");
  assert.deepEqual(a.blocks.map((b) => b.type), ["h", "p", "img", "p", "li", "quote"]);
  assert.equal(a.blocks[2].src, "https://example.com/img/m.jpg");
  assert.ok(!JSON.stringify(a).includes("Меню сайта") && !JSON.stringify(a).includes("alert"));
  assert.equal(php("echo json_encode(News::extractArticle($in, 'https://e.com/'));", "<p>мало</p>"), null);
});
