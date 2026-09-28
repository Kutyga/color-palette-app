<?php
/**
 * Серверные функции — замена Supabase Edge Functions с теми же адресами и ответами
 * (supabase/functions/*): POST /functions/v1/<имя>.
 *   identify-plant — вид и болезни по фото (Pl@ntNet + Gemini), квоты в базе;
 *   news-reader    — «режим чтения» статьи из news_articles;
 *   push           — открытый VAPID-ключ ({action: config}) и рассылка очереди ({action: send}, по секрету);
 *   news-ingest    — сбор новостей из RSS (по секрету; вызывает планировщик cron.php).
 * Ключи Pl@ntNet, Gemini и VAPID лежат в vault (перенесены из Supabase) и читаются функциями базы.
 */
final class Functions
{
    private const USER_DAILY_LIMIT = 20;
    private const TOTAL_DAILY_LIMIT = 450;
    private const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
    private const SERVICE_USER = '00000000-0000-0000-0000-00000000000f';
    private const PUSH_SUBJECT = 'https://github.com/Kutyga/color-palette-app';
    private const PUSH_TTL = 12 * 3600;
    private const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];
    private const CAUSE_IDS = ['overwatering', 'root_rot', 'underwatering', 'dry_air', 'low_light', 'sunburn', 'natural_aging',
        'hunger', 'stress', 'spider_mite', 'mealybug', 'scale', 'thrips', 'aphids', 'fungus_gnats', 'powdery_mildew',
        'leaf_spot', 'grey_mould'];

    public static function handle(string $method, string $name): never
    {
        if ($method !== 'POST') {
            Http::json(405, ['error' => 'method_not_allowed']);
        }
        $body = Http::body() ?? [];
        match ($name) {
            'identify-plant' => self::identify(is_array($body) ? $body : []),
            'news-reader' => self::reader(is_array($body) ? $body : []),
            'push' => self::push(is_array($body) ? $body : []),
            'news-ingest' => self::cronSecretOk(Http::header('x-cron-secret'))
                ? Http::json(200, self::ingestNews())
                : Http::json(403, ['error' => 'forbidden']),
            default => Http::json(404, ['error' => 'not_found']),
        };
    }

    /**
     * Служебный секрет планировщика — те же, что проверяла база в Supabase: у сбора новостей
     * (и проверочных вызовов распознавания) — news_ingest_secret, у рассылки push — push_send_secret.
     */
    public static function cronSecretOk(?string $secret, string $for = 'news'): bool
    {
        $fn = $for === 'push' ? 'public.push_verify_secret' : 'public.verify_news_ingest_secret';
        return $secret !== null && $secret !== ''
            && Db::service(fn (PDO $db) => Db::value($db, "select $fn(?)", [$secret])) === true;
    }

    // --- Распознавание ----------------------------------------------------------------------

    private static function identify(array $body): never
    {
        $userId = self::cronSecretOk(Http::header('x-cron-secret')) ? self::SERVICE_USER : (Auth::claims()['sub'] ?? null);
        if ($userId === null) {
            Http::json(401, ['error' => 'unauthorized']);
        }
        $raw = preg_replace(['/^data:[^;]+;base64,/', '/\s+/'], '', (string) ($body['image_base64'] ?? ''));
        if ($raw === '') {
            Http::json(400, ['error' => 'image_required']);
        }
        $image = base64_decode($raw, true);
        if ($image === false) {
            Http::json(400, ['error' => 'bad_image', 'detail' => 'image_base64 не похоже на base64']);
        }
        if ($image === '' || strlen($image) > self::MAX_IMAGE_BYTES) {
            Http::json(413, ['error' => 'image_size']);
        }
        $organ = in_array($body['organ'] ?? '', ['auto', 'leaf', 'flower', 'fruit', 'bark'], true) ? $body['organ'] : 'auto';

        [$allowed, $plantnetKey, $geminiKey] = Db::service(fn (PDO $db) => [
            Db::value($db, 'select public.consume_identify_quota(?, ?, ?)', [$userId, self::USER_DAILY_LIMIT, self::TOTAL_DAILY_LIMIT]),
            Db::value($db, 'select public.get_plantnet_key()'),
            Db::value($db, 'select public.get_gemini_key()'),
        ]);
        if ($allowed !== true) {
            Http::json(429, ['error' => 'quota_exceeded']);
        }
        if (!$plantnetKey) {
            Http::json(503, ['error' => 'not_configured']);
        }

        if (($body['mode'] ?? '') === 'diseases') {
            $diseases = null;
            $ai = null;
            try {
                $diseases = self::plantnet('diseases/identify', $plantnetKey, $image, $organ, [self::class, 'toDiseases']);
            } catch (Throwable $e) {
                error_log('podokonnik plantnet diseases: ' . $e->getMessage());
            }
            try {
                $ai = $geminiKey ? self::gemini($geminiKey, $image, isset($body['plant_hint']) ? (string) $body['plant_hint'] : null) : null;
            } catch (Throwable $e) {
                error_log('podokonnik gemini: ' . $e->getMessage());
            }
            if ($diseases === null && $ai === null) {
                Http::json(502, ['error' => 'upstream']);
            }
            Http::json(200, ['source' => 'plantnet', 'diseases' => $diseases ?? [], 'ai' => $ai]);
        }

        try {
            $payload = null;
            $results = self::plantnet('identify/all', $plantnetKey, $image, $organ, function (array $body) use (&$payload) {
                $payload = $body;
                return self::toIdentifications($body);
            });
        } catch (Throwable $e) {
            error_log('podokonnik plantnet identify: ' . $e->getMessage());
            Http::json(502, ['error' => 'upstream']);
        }
        Http::json(200, ['source' => 'plantnet', 'results' => $results,
                         'remaining' => $payload['remainingIdentificationRequests'] ?? null]);
    }

    /** Запрос к Pl@ntNet: фото в поле images; 404 — «ничего не нашли». */
    private static function plantnet(string $path, string $key, string $image, string $organ, callable $parse): array
    {
        $tmp = tempnam(sys_get_temp_dir(), 'pn');
        file_put_contents($tmp, $image);
        try {
            $url = "https://my-api.plantnet.org/v2/$path?" . http_build_query(
                ['api-key' => $key, 'lang' => 'ru', 'nb-results' => 5, 'include-related-images' => 'false']);
            $res = Fetch::request('POST', $url, [], ['images' => new CURLFile($tmp, 'image/jpeg', 'plant.jpg'), 'organs' => $organ], 20);
        } finally {
            @unlink($tmp);
        }
        if ($res['status'] === 404) {
            return [];
        }
        if ($res['status'] < 200 || $res['status'] >= 300) {
            throw new RuntimeException("HTTP {$res['status']} " . substr($res['body'], 0, 300));
        }
        return $parse(json_decode($res['body'], true) ?: []);
    }

    private static function toIdentifications(array $body): array
    {
        $out = [];
        foreach ($body['results'] ?? [] as $r) {
            $name = trim((string) ($r['species']['scientificNameWithoutAuthor'] ?? ''));
            if ($name === '' || !is_numeric($r['score'] ?? null)) {
                continue;
            }
            $out[] = [
                'name' => $name,
                'score' => max(0, min(1, (float) $r['score'])),
                'common_names' => array_slice(array_values(array_filter($r['species']['commonNames'] ?? [], 'is_string')), 0, 3),
                'genus' => $r['species']['genus']['scientificNameWithoutAuthor'] ?? null,
                'family' => $r['species']['family']['scientificNameWithoutAuthor'] ?? null,
            ];
        }
        usort($out, fn ($a, $b) => $b['score'] <=> $a['score']);
        return $out;
    }

    private static function toDiseases(array $body): array
    {
        $out = [];
        foreach ($body['results'] ?? [] as $r) {
            $eppo = is_string($r['name'] ?? null) ? trim($r['name']) : '';
            if ($eppo === '' || !is_numeric($r['score'] ?? null)) {
                continue;
            }
            $desc = is_string($r['description'] ?? null) ? trim($r['description']) : '';
            $out[] = ['eppo' => $eppo, 'score' => max(0, min(1, (float) $r['score'])), 'name' => $desc ?: $eppo];
        }
        usort($out, fn ($a, $b) => $b['score'] <=> $a['score']);
        return $out;
    }

    /** Gemini: осмотр растения, ответ строго по схеме; при перегрузке — запасная модель. */
    private static function gemini(string $key, string $image, ?string $hint): ?array
    {
        $hintText = $hint !== null && trim($hint) !== '' ? 'Владелец говорит, что это: ' . mb_substr(trim($hint), 0, 120) . '.' : 'Вид растения неизвестен.';
        $instruction = "Ты — опытный агроном по комнатным растениям. Осмотри фото и определи болезни, вредителей и ошибки ухода.\n"
            . "Правила:\n- Отвечай по-русски, коротко и по делу, без воды.\n"
            . "- Не выдумывай: если явных признаков проблем нет — healthy = true и пустой список problems.\n"
            . "- Если на фото нет растения — is_plant = false, healthy = false, problems пустой, в summary попроси сфотографировать растение.\n"
            . '- Для каждой проблемы поле cause — одно из: ' . implode(', ', self::CAUSE_IDS) . "; если ни одно не подходит — other.\n"
            . "- title — название проблемы по-русски; evidence — что именно видно на фото; confidence — уверенность от 0 до 1.\n"
            . '- Не больше трёх проблем, самые вероятные первыми.';
        $request = json_encode([
            'systemInstruction' => ['parts' => [['text' => $instruction]]],
            'contents' => [['role' => 'user', 'parts' => [
                ['inline_data' => ['mime_type' => 'image/jpeg', 'data' => base64_encode($image)]],
                ['text' => "$hintText Что с растением?"],
            ]]],
            'generationConfig' => ['responseMimeType' => 'application/json', 'temperature' => 0.2, 'maxOutputTokens' => 4096,
                'responseSchema' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'is_plant' => ['type' => 'BOOLEAN'], 'healthy' => ['type' => 'BOOLEAN'],
                        'plant' => ['type' => 'STRING', 'nullable' => true], 'summary' => ['type' => 'STRING'],
                        'problems' => ['type' => 'ARRAY', 'items' => ['type' => 'OBJECT', 'properties' => [
                            'cause' => ['type' => 'STRING', 'enum' => [...self::CAUSE_IDS, 'other']],
                            'title' => ['type' => 'STRING'], 'confidence' => ['type' => 'NUMBER'], 'evidence' => ['type' => 'STRING'],
                        ], 'required' => ['cause', 'title', 'confidence', 'evidence']]],
                    ],
                    'required' => ['is_plant', 'healthy', 'summary', 'problems'],
                ]],
        ], JSON_UNESCAPED_UNICODE);
        $last = '';
        foreach (self::GEMINI_MODELS as $model) {
            $res = Fetch::request('POST', "https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent",
                ['Content-Type' => 'application/json', 'x-goog-api-key' => $key], $request, 25);
            if ($res['status'] !== 200) {
                $last = "$model: HTTP {$res['status']} " . substr($res['body'], 0, 300);
                if (in_array($res['status'], [429, 500, 503], true)) {
                    continue;
                }
                break;
            }
            $diagnosis = self::toAiDiagnosis(json_decode($res['body'], true) ?: []);
            if ($diagnosis !== null) {
                return $diagnosis;
            }
            $last = "$model: ответ не по схеме";
        }
        throw new RuntimeException($last);
    }

    private static function toAiDiagnosis(array $body): ?array
    {
        $text = '';
        foreach ($body['candidates'][0]['content']['parts'] ?? [] as $p) {
            if (empty($p['thought'])) {
                $text .= $p['text'] ?? '';
            }
        }
        $start = strpos($text, '{');
        $end = strrpos($text, '}');
        $raw = $start !== false && $end > $start ? json_decode(substr($text, $start, $end - $start + 1), true) : null;
        if (!is_array($raw)) {
            return null;
        }
        $str = fn ($v, $max) => is_string($v) ? mb_substr(trim($v), 0, $max) : '';
        $problems = [];
        foreach (is_array($raw['problems'] ?? null) ? $raw['problems'] : [] as $p) {
            $title = $str($p['title'] ?? null, 120);
            if ($title === '') {
                continue;
            }
            $problems[] = [
                'cause' => in_array($p['cause'] ?? null, self::CAUSE_IDS, true) ? $p['cause'] : 'other',
                'title' => $title,
                'confidence' => is_numeric($p['confidence'] ?? null) ? max(0, min(1, (float) $p['confidence'])) : 0.5,
                'evidence' => $str($p['evidence'] ?? null, 400),
            ];
        }
        usort($problems, fn ($a, $b) => $b['confidence'] <=> $a['confidence']);
        $problems = array_slice($problems, 0, 3);
        $isPlant = ($raw['is_plant'] ?? true) !== false;
        return [
            'isPlant' => $isPlant,
            'healthy' => $isPlant && ($raw['healthy'] ?? false) === true && $problems === [],
            'plant' => $str($raw['plant'] ?? null, 120) ?: null,
            'summary' => $str($raw['summary'] ?? null, 600),
            'problems' => $isPlant ? $problems : [],
        ];
    }

    // --- Режим чтения -------------------------------------------------------------------------

    private static function reader(array $body): never
    {
        $id = $body['id'] ?? null;
        if (!is_string($id) || !preg_match('/^[0-9a-f-]{36}$/i', $id)) {
            Http::json(400, ['error' => 'bad_id']);
        }
        // От имени пользователя: RLS решает, видна ли ему новость. Скачиваем только адреса из базы.
        $article = Db::asUser(Auth::claims(), fn (PDO $db) => Db::row($db,
            'select url, title, language from public.news_articles where id = ?', [$id]));
        if ($article === null) {
            Http::json(404, ['error' => 'not_found']);
        }
        try {
            $res = Fetch::request('GET', $article['url'], [
                'User-Agent' => 'Mozilla/5.0 (compatible; PodokonnikReader/1.0; +https://podokonnikapp.ru/)',
                'Accept' => 'text/html,application/xhtml+xml',
            ], null, 12, 3 * 1024 * 1024);
        } catch (Throwable $e) {
            Http::json(502, ['error' => 'fetch_failed', 'message' => $e->getMessage()]);
        }
        if ($res['status'] < 200 || $res['status'] >= 300) {
            Http::json(502, ['error' => 'source_unavailable', 'status' => $res['status']]);
        }
        if (!str_contains($res['headers']['content-type'] ?? '', 'html')) {
            Http::json(422, ['error' => 'not_html']);
        }
        if ($res['truncated']) {
            Http::json(422, ['error' => 'too_large']);
        }
        $parsed = News::extractArticle($res['body'], $res['url']);
        if ($parsed === null) {
            Http::json(422, ['error' => 'no_article']);
        }
        header('Cache-Control: private, max-age=3600');
        Http::json(200, array_merge($parsed, [
            'url' => $article['url'],
            'title' => $parsed['title'] ?: $article['title'],
            'lang' => $parsed['lang'] ?? $article['language'],
        ]));
    }

    // --- Push ---------------------------------------------------------------------------------

    private static function push(array $body): never
    {
        try {
            match ($body['action'] ?? '') {
                'config' => Http::json(200, ['publicKey' => self::vapidKeys()['publicKey']]),
                'send' => self::cronSecretOk(Http::header('x-cron-secret'), 'push')
                    ? Http::json(200, self::sendPush())
                    : Http::json(403, ['error' => 'forbidden']),
                default => Http::json(400, ['error' => 'unknown_action']),
            };
        } catch (RuntimeException $e) {
            Http::json(500, ['error' => $e->getMessage()]);
        }
    }

    /** Ключи VAPID из vault; если их ещё нет — создаём и сохраняем (как делала функция Supabase). */
    private static function vapidKeys(): array
    {
        $read = fn () => Db::service(fn (PDO $db) => Db::row($db, 'select * from public.push_vapid_keys()'));
        $row = $read();
        if (!empty($row['public_key']) && !empty($row['private_key'])) {
            return ['publicKey' => $row['public_key'], 'privateKey' => $row['private_key']];
        }
        $fresh = WebPush::generateKeys();
        Db::service(fn (PDO $db) => Db::run($db, 'select public.push_store_vapid_keys(?, ?)', [$fresh['publicKey'], $fresh['privateKey']]));
        $row = $read();
        return !empty($row['public_key']) ? ['publicKey' => $row['public_key'], 'privateKey' => $row['private_key']] : $fresh;
    }

    /** Разослать очередь private.push_queue (до 200 за раз). */
    public static function sendPush(): array
    {
        $vapid = self::vapidKeys();
        $items = Db::service(fn (PDO $db) => Db::run($db, 'select * from public.push_take_batch(200)')->fetchAll());
        $ok = [];
        $gone = [];
        $failed = [];
        foreach ($items as $it) {
            $payload = json_encode(['title' => $it['title'], 'body' => $it['body'], 'url' => $it['url'], 'tag' => $it['tag']], JSON_UNESCAPED_UNICODE);
            try {
                $status = WebPush::send($it, $payload, $vapid, self::PUSH_SUBJECT, self::PUSH_TTL);
                if ($status >= 200 && $status < 300) {
                    $ok[] = $it['subscription_id'];
                } elseif ($status === 404 || $status === 410) {
                    $gone[] = $it['subscription_id'];
                } else {
                    $failed[] = "$status";
                }
            } catch (Throwable $e) {
                $failed[] = mb_substr($e->getMessage(), 0, 200);
            }
        }
        if ($ok || $gone) {
            $arr = fn (array $ids) => '{' . implode(',', $ids) . '}';
            Db::service(fn (PDO $db) => Db::run($db, 'select public.push_report(?::uuid[], ?::uuid[])', [$arr($ok), $arr($gone)]));
        }
        return ['sent' => count($ok), 'gone' => count($gone), 'failed' => $failed];
    }

    // --- Сбор новостей ------------------------------------------------------------------------

    public static function ingestNews(): array
    {
        $sources = Db::service(fn (PDO $db) => Db::run($db,
            'select id, name, feed_url, filter_keywords from public.news_sources where enabled')->fetchAll());
        $report = [];
        foreach ($sources as $s) {
            try {
                $res = Fetch::request('GET', $s['feed_url'],
                    ['User-Agent' => 'PodokonnikNewsBot/1.0 (+https://podokonnikapp.ru/)'], null, 15, 5 * 1024 * 1024);
                if ($res['status'] < 200 || $res['status'] >= 300) {
                    throw new RuntimeException("HTTP {$res['status']}");
                }
                $items = News::parseFeed($res['body']);
                if ($s['filter_keywords']) {
                    $items = array_values(array_filter($items, [News::class, 'isAboutPlants']));
                }
                $items = array_slice($items, 0, 30);
                $report[$s['name']] = (int) Db::service(fn (PDO $db) => Db::value($db, 'select public.ingest_news(?, ?::jsonb)',
                    [$s['id'], json_encode($items, JSON_UNESCAPED_UNICODE)]));
            } catch (Throwable $e) {
                $report[$s['name']] = 'error: ' . $e->getMessage();
                Db::service(fn (PDO $db) => Db::run($db,
                    'update public.news_sources set last_error = ?, last_fetched_at = now() where id = ?', [$e->getMessage(), $s['id']]));
            }
        }
        return $report;
    }
}
