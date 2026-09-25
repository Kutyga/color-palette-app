import { assertEquals, assert } from "jsr:@std/assert@1";
import { absoluteUrl, extractArticle } from "./extract.ts";

const page = `<!doctype html><html lang="en"><head><title>Repotting a monstera — Garden Blog</title></head><body>
<nav><a href="/">Home</a><a href="/shop">Shop</a></nav>
<article>
  <h1>Repotting a monstera</h1>
  <p class="byline">By Anna Green</p>
  <p>Monstera deliciosa grows fast and usually needs a bigger pot every two years. ${"Roots circling the pot are the clearest sign. ".repeat(8)}</p>
  <p><img src="/img/monstera.jpg" alt="Monstera in a new pot"></p>
  <h2>What you need</h2>
  <ul><li>A pot 3–5 cm wider</li><li>Chunky aroid mix</li></ul>
  <p>Water lightly after repotting and keep the plant out of direct sun for a week. ${"Be patient while it settles. ".repeat(6)}</p>
  <p><img src="javascript:alert(1)"></p>
</article>
<script>alert("x")</script>
<footer>© Garden Blog</footer>
</body></html>`;

Deno.test("основной текст без меню, скриптов и опасных ссылок", () => {
  const a = extractArticle(page, "https://example.org/blog/monstera")!;
  assert(a, "статья извлечена");
  assertEquals(a.lang, "en");
  const text = a.blocks.filter((b) => b.type !== "img").map((b) => ("text" in b ? b.text : "")).join("\n");
  assert(text.includes("needs a bigger pot"));
  assert(!text.includes("Shop"), "меню отброшено");
  assert(!text.includes("alert"), "скрипты отброшены");
  const imgs = a.blocks.filter((b) => b.type === "img");
  assertEquals(imgs.map((b) => ("src" in b ? b.src : "")), ["https://example.org/img/monstera.jpg"]);
  assert(a.blocks.some((b) => b.type === "li" && b.text === "Chunky aroid mix"));
  assert(a.blocks.some((b) => b.type === "h" && b.text === "What you need"));
});

Deno.test("страница без статьи", () => {
  assertEquals(extractArticle("<html><body><nav>menu</nav></body></html>", "https://example.org"), null);
});

Deno.test("абсолютные ссылки", () => {
  assertEquals(absoluteUrl("/a.jpg", "https://x.org/p/"), "https://x.org/a.jpg");
  assertEquals(absoluteUrl("data:image/png;base64,AA", "https://x.org"), null);
  assertEquals(absoluteUrl(null, "https://x.org"), null);
});
