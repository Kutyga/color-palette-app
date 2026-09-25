// Запуск: node --experimental-strip-types --test supabase/functions/news-ingest/feed.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanText, isAboutPlants, parseFeed } from "./feed.ts";

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>Ботаничка</title>
  <item>
    <title><![CDATA[Монстера: 5 ошибок при поливе]]></title>
    <link>https://example.org/monstera?utm=1&amp;x=2</link>
    <pubDate>Mon, 21 Sep 2026 08:30:00 +0300</pubDate>
    <description><![CDATA[<p><img src="https://example.org/m.jpg"/>Не поливайте <b>холодной</b> водой &mdash; и&nbsp;всё будет хорошо.</p><script>alert(1)</script>]]></description>
  </item>
  <item>
    <title>Без ссылки</title>
  </item>
  <item>
    <title>Фикус &amp; зима</title>
    <link>https://example.org/ficus</link>
    <enclosure url="https://example.org/f.jpg" type="image/jpeg" length="1"/>
    <description>Коротко</description>
  </item>
</channel>
</rss>`;

const atom = `<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title type="html">New orchid species found in Borneo</title>
    <link rel="alternate" type="text/html" href="https://example.com/orchid"/>
    <link rel="enclosure" href="https://example.com/orchid.mp3"/>
    <published>2026-09-20T10:00:00Z</published>
    <summary>Botanists describe a tiny orchid.</summary>
    <media:thumbnail url="https://example.com/o.jpg"/>
  </entry>
  <entry>
    <title>Black hole merger observed</title>
    <link href="https://example.com/space"/>
    <updated>not a date</updated>
    <summary>Astronomers report a new gravitational wave event.</summary>
  </entry>
</feed>`;

test("RSS: CDATA, сущности, картинка из описания, пропуск записей без ссылки", () => {
  const items = parseFeed(rss);
  assert.equal(items.length, 2);
  const [monstera, ficus] = items;
  assert.equal(monstera.title, "Монстера: 5 ошибок при поливе");
  assert.equal(monstera.url, "https://example.org/monstera?utm=1&x=2");
  assert.equal(monstera.summary, "Не поливайте холодной водой — и всё будет хорошо.");
  assert.equal(monstera.image_url, "https://example.org/m.jpg");
  assert.equal(monstera.published_at, "2026-09-21T05:30:00.000Z");
  assert.equal(ficus.title, "Фикус & зима");
  assert.equal(ficus.image_url, "https://example.org/f.jpg");
  assert.equal(ficus.published_at, null);
});

test("Atom: ссылка rel=alternate, миниатюра, некорректная дата", () => {
  const items = parseFeed(atom);
  assert.equal(items.length, 2);
  assert.equal(items[0].url, "https://example.com/orchid");
  assert.equal(items[0].image_url, "https://example.com/o.jpg");
  assert.equal(items[0].published_at, "2026-09-20T10:00:00.000Z");
  assert.equal(items[1].published_at, null);
});

test("фильтр по ключевым словам для общих научных лент", () => {
  const [orchid, space] = parseFeed(atom);
  assert.equal(isAboutPlants(orchid), true);
  assert.equal(isAboutPlants(space), false);
});

test("выдержка обрезается по слову", () => {
  const long = `<rss><channel><item><title>T</title><link>https://e.org/1</link><description>${"слово ".repeat(200)}</description></item></channel></rss>`;
  const [item] = parseFeed(long);
  assert.ok(item.summary.length <= 500);
  assert.ok(item.summary.endsWith("слово…"));
});

test("cleanText убирает теги и скрипты", () => {
  assert.equal(cleanText("<p>Привет<script>x()</script>, <i>мир</i></p>"), "Привет , мир");
});
