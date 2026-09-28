<?php
/**
 * Новости: разбор RSS/Atom (как supabase/functions/news-ingest/feed.ts) и «режим чтения» —
 * основной текст статьи простыми блоками (как news-reader/extract.ts, но без Readability:
 * выбираем блок страницы с наибольшим количеством текста в абзацах).
 */
final class News
{
    private const SUMMARY_LIMIT = 500;
    private const MAX_BLOCKS = 400;
    /** Ключевые слова «про растения» — для общих научных лент (filter_keywords = true). */
    private const PLANT_KEYWORDS = ['растени', 'цвет', 'цвето', 'сад', 'огород', 'орхиде', 'кактус', 'суккулент', 'фикус',
        'монстер', 'полив', 'удобрен', 'пересад', 'листь', 'ботани', 'семен', 'рассад', 'plant', 'flower', 'garden', 'botan',
        'orchid', 'cactus', 'succulent', 'houseplant', 'seed', 'leaf', 'leaves', 'fern', 'moss', 'tree', 'pollinat', 'photosynth'];

    // --- Ленты -----------------------------------------------------------------------------

    /** @return list<array{url: string, title: string, summary: string, image_url: ?string, published_at: ?string}> */
    public static function parseFeed(string $xml): array
    {
        preg_match_all('/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/i', $xml, $m);
        $items = [];
        foreach ($m[2] as $block) {
            $title = self::cleanText(self::tag($block, 'title'));
            $url = self::link($block);
            if ($title === '' || $url === null) {
                continue;
            }
            $description = self::tag($block, 'description') ?? self::tag($block, 'summary')
                ?? self::tag($block, 'content:encoded') ?? self::tag($block, 'content');
            $items[] = [
                'url' => $url,
                'title' => $title,
                'summary' => self::truncate(self::cleanText($description), self::SUMMARY_LIMIT),
                'image_url' => self::image($block, $description),
                'published_at' => self::date(self::tag($block, 'pubDate') ?? self::tag($block, 'published')
                    ?? self::tag($block, 'updated') ?? self::tag($block, 'dc:date')),
            ];
        }
        return $items;
    }

    public static function isAboutPlants(array $item): bool
    {
        $text = mb_strtolower($item['title'] . ' ' . $item['summary']);
        foreach (self::PLANT_KEYWORDS as $k) {
            if (str_contains($text, $k)) {
                return true;
            }
        }
        return false;
    }

    private static function tag(string $block, string $name): ?string
    {
        $n = preg_quote($name, '/');
        return preg_match("/<$n\\b[^>]*>([\\s\\S]*?)<\\/$n>/i", $block, $m) ? self::unwrapCdata($m[1]) : null;
    }

    private static function link(string $block): ?string
    {
        $href = null;
        if (preg_match_all('/<link\b([^>]*?)\/?>/i', $block, $m)) {
            foreach ($m[1] as $attrs) {
                if (preg_match('/href=/', $attrs) && (!preg_match('/rel=/', $attrs) || preg_match('/rel=["\']alternate["\']/', $attrs))) {
                    $href = self::attr($attrs, 'href');
                    break;
                }
            }
        }
        $href ??= self::cleanText(self::tag($block, 'link')) ?: self::cleanText(self::tag($block, 'guid'));
        return $href && preg_match('/^https?:\/\//i', $href) ? self::decode($href) : null;
    }

    private static function image(string $block, ?string $description): ?string
    {
        foreach (['/<media:content\b([^>]*)>/i', '/<media:thumbnail\b([^>]*)>/i', '/<enclosure\b([^>]*type=["\']image[^>]*)>/i'] as $re) {
            if (preg_match($re, $block, $m) && ($url = self::attr($m[1], 'url')) && preg_match('/^https?:\/\//i', $url)) {
                return self::decode($url);
            }
        }
        if ($description && preg_match('/<img\b[^>]*src=["\']([^"\']+)["\']/i', self::decode($description), $m)
            && preg_match('/^https?:\/\//i', $m[1])) {
            return $m[1];
        }
        return null;
    }

    private static function attr(string $attrs, string $name): ?string
    {
        return preg_match('/' . $name . '=["\']([^"\']+)["\']/i', $attrs, $m) ? $m[1] : null;
    }

    private static function date(?string $value): ?string
    {
        $t = $value ? strtotime(trim($value)) : false;
        return $t === false ? null : gmdate('Y-m-d\TH:i:s.000\Z', $t);
    }

    private static function unwrapCdata(string $s): string
    {
        return preg_replace('/<!\[CDATA\[([\s\S]*?)\]\]>/', '$1', $s);
    }

    /** Убирает HTML, скрипты и лишние пробелы; раскодирует сущности. */
    public static function cleanText(?string $s): string
    {
        if (!$s) {
            return '';
        }
        $s = self::decode(self::unwrapCdata($s));
        $s = preg_replace(['/<(script|style)\b[\s\S]*?<\/\1>/i', '/<[^>]+>/'], ' ', $s);
        return trim(preg_replace('/\s+/u', ' ', self::decode($s)));
    }

    private static function decode(string $s): string
    {
        return html_entity_decode($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    private static function truncate(string $s, int $limit): string
    {
        if (mb_strlen($s) <= $limit) {
            return $s;
        }
        $cut = mb_substr($s, 0, $limit - 1);
        $space = mb_strrpos($cut, ' ');
        return ($space !== false && $space > $limit * 0.6 ? mb_substr($cut, 0, $space) : $cut) . '…';
    }

    // --- Режим чтения ---------------------------------------------------------------------------

    /** Основной текст статьи блоками {type: p|h|li|quote, text} | {type: img, src, alt} или null. */
    public static function extractArticle(string $html, string $url): ?array
    {
        if (!mb_check_encoding($html, 'UTF-8')) {
            $html = mb_convert_encoding($html, 'UTF-8', 'Windows-1251');
        }
        $doc = new DOMDocument();
        libxml_use_internal_errors(true);
        $doc->loadHTML('<?xml encoding="UTF-8">' . $html, LIBXML_NONET | LIBXML_NOERROR);
        libxml_clear_errors();
        $xp = new DOMXPath($doc);
        foreach ($xp->query('//script|//style|//noscript|//nav|//header|//footer|//aside|//form|//iframe') as $n) {
            $n->parentNode?->removeChild($n);
        }
        $lang = trim((string) $xp->evaluate('string(/html/@lang)')) ?: null;
        $title = self::meta($xp, 'og:title') ?? trim((string) $xp->evaluate('string(//title)'));
        $siteName = self::meta($xp, 'og:site_name');
        $byline = self::meta($xp, 'author');
        $excerpt = self::meta($xp, 'og:description') ?? self::meta($xp, 'description');

        // Контейнер статьи: <article>, иначе элемент, у которого больше всего текста в прямых абзацах.
        $best = null;
        $bestScore = 0;
        foreach ($xp->query('//article|//main|//div|//section') as $el) {
            $score = 0;
            foreach ($el->childNodes as $c) {
                if ($c instanceof DOMElement && in_array(strtolower($c->tagName), ['p', 'h2', 'h3', 'ul', 'ol', 'blockquote', 'figure'], true)) {
                    $score += mb_strlen(trim($c->textContent));
                }
            }
            if (strtolower($el->tagName) === 'article') {
                $score *= 1.5;
            }
            if ($score > $bestScore) {
                [$best, $bestScore] = [$el, $score];
            }
        }
        if ($best === null || $bestScore < 300) {
            return null;
        }

        $blocks = [];
        $clean = fn (?string $s) => trim(preg_replace('/\s+/u', ' ', (string) $s));
        $pushImage = function (DOMElement $img) use (&$blocks, $url, $clean) {
            $src = self::absoluteUrl($img->getAttribute('src') ?: $img->getAttribute('data-src'), $url);
            if ($src) {
                $blocks[] = ['type' => 'img', 'src' => $src, 'alt' => $clean($img->getAttribute('alt'))];
            }
        };
        $walk = function (DOMElement $el) use (&$walk, &$blocks, $pushImage, $clean) {
            foreach ($el->childNodes as $child) {
                if (count($blocks) >= self::MAX_BLOCKS || !$child instanceof DOMElement) {
                    continue;
                }
                $tag = strtolower($child->tagName);
                if ($tag === 'img') {
                    $pushImage($child);
                } elseif (preg_match('/^h[1-6]$/', $tag)) {
                    if ($text = $clean($child->textContent)) {
                        $blocks[] = ['type' => 'h', 'text' => $text];
                    }
                } elseif (in_array($tag, ['p', 'li', 'blockquote', 'figcaption'], true)) {
                    foreach ($child->getElementsByTagName('img') as $img) {
                        $pushImage($img);
                    }
                    if ($text = $clean($child->textContent)) {
                        $blocks[] = ['type' => $tag === 'li' ? 'li' : ($tag === 'blockquote' ? 'quote' : 'p'), 'text' => $text];
                    }
                } else {
                    $walk($child);
                }
            }
        };
        $walk($best);
        $hasText = array_filter($blocks, fn ($b) => $b['type'] !== 'img');
        if ($hasText === []) {
            return null;
        }
        return ['title' => $clean($title), 'byline' => $byline, 'siteName' => $siteName, 'lang' => $lang,
                'excerpt' => $excerpt, 'blocks' => $blocks];
    }

    private static function meta(DOMXPath $xp, string $name): ?string
    {
        $v = trim((string) $xp->evaluate("string(//meta[@property='$name' or @name='$name']/@content)"));
        return $v === '' ? null : $v;
    }

    /** Абсолютная http(s)-ссылка или null (data:, javascript: и прочее отбрасываем). */
    public static function absoluteUrl(?string $src, string $base): ?string
    {
        $src = trim((string) $src);
        if ($src === '' || preg_match('/^(data|javascript):/i', $src)) {
            return null;
        }
        if (preg_match('/^https?:\/\//i', $src)) {
            return $src;
        }
        $b = parse_url($base);
        if (!isset($b['scheme'], $b['host'])) {
            return null;
        }
        $origin = $b['scheme'] . '://' . $b['host'] . (isset($b['port']) ? ':' . $b['port'] : '');
        if (str_starts_with($src, '//')) {
            return $b['scheme'] . ':' . $src;
        }
        if (str_starts_with($src, '/')) {
            return $origin . $src;
        }
        $dir = preg_replace('#/[^/]*$#', '/', $b['path'] ?? '/');
        return $origin . $dir . $src;
    }
}
