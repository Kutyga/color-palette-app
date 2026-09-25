/// <reference lib="dom" />
// Извлечение основного текста статьи: Readability (как «режим чтения» в Firefox) поверх linkedom.
// Возвращаем не HTML, а простые блоки — сайт выводит их как текст, чужая разметка и скрипты
// на страницу не попадают.
import { Readability } from "npm:@mozilla/readability@0.6.0";
import { parseHTML } from "npm:linkedom@0.18.12";

export type Block =
  | { type: "p" | "h" | "li" | "quote"; text: string }
  | { type: "img"; src: string; alt: string };

export interface ReaderArticle {
  title: string;
  byline: string | null;
  siteName: string | null;
  lang: string | null;
  excerpt: string | null;
  blocks: Block[];
}

const MAX_BLOCKS = 400;

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** Абсолютная http(s)-ссылка или null (data:, javascript: и прочее отбрасываем). */
export function absoluteUrl(src: string | null | undefined, base: string): string | null {
  if (!src) return null;
  try {
    const u = new URL(src, base);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

export function extractArticle(html: string, url: string): ReaderArticle | null {
  const { document } = parseHTML(html);
  const lang = clean(document.documentElement?.getAttribute("lang")) || null;
  const parsed = new Readability(document as unknown as Document, { charThreshold: 300 }).parse();
  if (!parsed?.content) return null;

  const { document: body } = parseHTML(`<!doctype html><html><body>${parsed.content}</body></html>`);
  const blocks: Block[] = [];
  const pushImage = (img: Element) => {
    const src = absoluteUrl(img.getAttribute("src") ?? img.getAttribute("data-src"), url);
    if (src) blocks.push({ type: "img", src, alt: clean(img.getAttribute("alt")) });
  };
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      if (blocks.length >= MAX_BLOCKS) return;
      const tag = child.tagName.toLowerCase();
      if (tag === "img") {
        pushImage(child);
      } else if (/^h[1-6]$/.test(tag)) {
        const text = clean(child.textContent);
        if (text) blocks.push({ type: "h", text });
      } else if (tag === "p" || tag === "li" || tag === "blockquote" || tag === "figcaption") {
        // Картинки внутри абзаца — отдельными блоками, текст — одним.
        child.querySelectorAll("img").forEach(pushImage);
        const text = clean(child.textContent);
        if (text) blocks.push({ type: tag === "li" ? "li" : tag === "blockquote" ? "quote" : "p", text });
      } else {
        walk(child);
      }
    }
  };
  walk(body.body as unknown as Element);
  if (!blocks.some((b) => b.type !== "img")) return null;

  return {
    title: clean(parsed.title),
    byline: clean(parsed.byline) || null,
    siteName: clean(parsed.siteName) || null,
    lang: clean(parsed.lang) || lang,
    excerpt: clean(parsed.excerpt) || null,
    blocks,
  };
}
