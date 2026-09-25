// Разбор RSS 2.0 / Atom без зависимостей: работает и в Deno (Edge Functions), и в Node (тесты).

export interface FeedItem {
  url: string;
  title: string;
  summary: string;
  image_url: string | null;
  published_at: string | null;
}

const SUMMARY_LIMIT = 500;

/** Ключевые слова «про растения» — для общих научных лент (filter_keywords = true). */
export const PLANT_KEYWORDS = [
  "растени", "цвет", "цвето", "сад", "огород", "орхиде", "кактус", "суккулент", "фикус", "монстер",
  "полив", "удобрен", "пересад", "листь", "ботани", "семен", "рассад",
  "plant", "flower", "garden", "botan", "orchid", "cactus", "succulent", "houseplant", "seed",
  "leaf", "leaves", "fern", "moss", "tree", "pollinat", "photosynth",
];

export function parseFeed(xml: string): FeedItem[] {
  const blocks = matchAll(xml, /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi).map((m) => m[2]);
  const items: FeedItem[] = [];
  for (const block of blocks) {
    const title = cleanText(tag(block, "title"));
    const url = link(block);
    if (!title || !url) continue;
    const description = tag(block, "description") ?? tag(block, "summary") ?? tag(block, "content:encoded") ?? tag(block, "content");
    items.push({
      url,
      title,
      summary: truncate(cleanText(description), SUMMARY_LIMIT),
      image_url: image(block, description),
      published_at: date(tag(block, "pubDate") ?? tag(block, "published") ?? tag(block, "updated") ?? tag(block, "dc:date")),
    });
  }
  return items;
}

export function isAboutPlants(item: FeedItem, keywords = PLANT_KEYWORDS): boolean {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  return keywords.some((k) => text.includes(k));
}

function tag(block: string, name: string): string | null {
  const escaped = name.replace(":", "\\:");
  const m = new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)</${escaped}>`, "i").exec(block);
  return m ? unwrapCdata(m[1]) : null;
}

function link(block: string): string | null {
  // Atom: <link rel="alternate" href="..."/>; RSS: <link>...</link>
  const atom = matchAll(block, /<link\b([^>]*?)\/?>/gi)
    .map((m) => m[1])
    .find((attrs) => /href=/.test(attrs) && (!/rel=/.test(attrs) || /rel=["']alternate["']/.test(attrs)));
  const href = atom ? attr(atom, "href") : cleanText(tag(block, "link")) || cleanText(tag(block, "guid"));
  return href && /^https?:\/\//i.test(href) ? decodeEntities(href) : null;
}

function image(block: string, description: string | null): string | null {
  for (const re of [
    /<media:content\b([^>]*)>/i,
    /<media:thumbnail\b([^>]*)>/i,
    /<enclosure\b([^>]*type=["']image[^>]*)>/i,
  ]) {
    const m = re.exec(block);
    const url = m ? attr(m[1], "url") : null;
    if (url && /^https?:\/\//i.test(url)) return decodeEntities(url);
  }
  const img = description ? /<img\b[^>]*src=["']([^"']+)["']/i.exec(decodeEntities(description)) : null;
  return img && /^https?:\/\//i.test(img[1]) ? img[1] : null;
}

function attr(attrs: string, name: string): string | null {
  const m = new RegExp(`${name}=["']([^"']+)["']`, "i").exec(attrs);
  return m ? m[1] : null;
}

function date(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value.trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function unwrapCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

/** Убирает HTML, скрипты и лишние пробелы; раскодирует сущности. */
export function cleanText(s: string | null): string {
  if (!s) return "";
  const decoded = decodeEntities(unwrapCdata(s));
  return decodeEntities(
    decoded
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  ).replace(/\s+/g, " ").trim();
}

const NAMED_ENTITIES: Record<string, string> = {
  mdash: "—", ndash: "–", laquo: "«", raquo: "»", hellip: "…", rsquo: "’", lsquo: "‘",
  ldquo: "“", rdquo: "”", bdquo: "„", copy: "©", deg: "°", times: "×", middot: "·",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&([a-z]+);/g, (m, name) => NAMED_ENTITIES[name] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function truncate(s: string, limit: number): string {
  if (s.length <= limit) return s;
  const cut = s.slice(0, limit - 1);
  const space = cut.lastIndexOf(" ");
  return `${space > limit * 0.6 ? cut.slice(0, space) : cut}…`;
}

function matchAll(s: string, re: RegExp): RegExpExecArray[] {
  const out: RegExpExecArray[] = [];
  for (let m = re.exec(s); m; m = re.exec(s)) out.push(m);
  return out;
}
