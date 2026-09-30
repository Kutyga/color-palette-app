<?php
/**
 * Запасной путь к Supabase через свой домен: podokonnikapp.ru/sb/{auth,rest,storage,functions}/v1/…
 * Часть российских операторов не пропускает *.supabase.co; тогда сайт (web/src/lib/net.ts) шлёт
 * запросы сюда, а хостинг пересылает их в Supabase и отдаёт ответ как есть.
 * Пересылает только в свой проект Supabase (адрес — upstream.php, его пишет выкладка) и только
 * пути API — это не открытый прокси. Веб-сокеты (Realtime) не проходят: чат в этом режиме опрашивает.
 */
declare(strict_types=1);

/**
 * Фото из приватных бакетов хранятся копией на хостинге (photo-cache/): Supabase отдаёт каждый
 * файл один раз, дальше — с диска хостинга, байт в байт (без пересжатия). Трафик Supabase
 * ограничен, место на хостинге — нет. Права не меняются: ссылку с токеном каждый раз проверяет
 * сам Supabase — запросом первого байта файла; просроченная или чужая ссылка не откроет копию.
 */
const PHOTO_RE = '#^storage/v1/object/sign/((?:plant-photos|post-photos|listing-photos|avatars)/[A-Za-z0-9/_.-]+\.jpg)\?token=[A-Za-z0-9._-]+$#';
const PHOTO_DIR = __DIR__ . '/photo-cache';

/** Спросить Supabase, действительна ли ссылка: скачивается только первый байт. */
function photoStatus(string $url): int
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RANGE => '0-0',
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 20,
        // Если Supabase не поддержит Range и начнёт отдавать весь файл — обрываем после первого куска.
        CURLOPT_WRITEFUNCTION => fn ($ch, string $chunk) => 0,
    ]);
    curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    return $code;
}

function sendPhoto(string $file): void
{
    header('Content-Type: image/jpeg');
    header('Content-Length: ' . filesize($file));
    // Фото по одному пути не меняется; хранить может только этот браузер.
    header('Cache-Control: private, max-age=31536000, immutable');
    readfile($file);
}

function photoError(int $code): void
{
    http_response_code($code >= 400 ? $code : 502);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'photo_unavailable']);
}

function servePhoto(string $upstream, string $path, string $key): void
{
    $url = $upstream . '/' . $path;
    $file = PHOTO_DIR . '/' . sha1($key) . '.jpg';
    if (is_file($file)) {
        $code = photoStatus($url);
        if ($code === 200 || $code === 206) {
            sendPhoto($file);
        } else {
            photoError($code);
        }
        return;
    }

    if (!is_dir(PHOTO_DIR)) {
        @mkdir(PHOTO_DIR, 0750, true);
        @file_put_contents(PHOTO_DIR . '/.htaccess', "Require all denied\n");
    }
    $tmp = @tempnam(PHOTO_DIR, 'dl');
    $out = $tmp === false ? false : fopen($tmp, 'wb');
    if ($out === false) {
        // Диск недоступен — отдаём как обычный прокси, без копии.
        $tmp = null;
        $out = fopen('php://temp', 'w+b');
    }
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_FILE => $out, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 60]);
    curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $type = (string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    $failed = curl_errno($ch) !== 0;
    curl_close($ch);

    if ($failed || $code !== 200 || !str_starts_with($type, 'image/')) {
        fclose($out);
        if ($tmp !== null) {
            @unlink($tmp);
        }
        photoError($failed ? 502 : $code);
        return;
    }
    if ($tmp === null) {
        rewind($out);
        header('Content-Type: image/jpeg');
        header('Cache-Control: private, max-age=31536000, immutable');
        fpassthru($out);
        fclose($out);
        return;
    }
    fclose($out);
    @chmod($tmp, 0640);
    if (!@rename($tmp, $file)) {
        @unlink($tmp);
        photoError(502);
        return;
    }
    sendPhoto($file);
}

$upstream = rtrim((string) (require __DIR__ . '/upstream.php'), '/');
$uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
$pos = strpos($uri, '/sb/');
$path = $pos === false ? '' : substr($uri, $pos + 4);

if (!preg_match('#^(auth|rest|storage|functions)/v1/#', $path) || !preg_match('#^https://[a-z0-9]+\.supabase\.co$#', $upstream)) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo '{"error":"not_found"}';
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
    http_response_code(204); // сайт и прокси на одном домене — CORS не нужен
    exit;
}

if ($method === 'GET' && preg_match(PHOTO_RE, $path, $m) && !str_contains($m[1], '..')) {
    servePhoto($upstream, $path, $m[1]);
    exit;
}

// Заголовки запроса, которые нужны Supabase; cookie и прочее не пересылаем.
$pass = ['apikey', 'authorization', 'content-type', 'prefer', 'range', 'accept', 'accept-profile', 'content-profile',
         'x-client-info', 'x-upsert', 'x-supabase-api-version', 'cache-control', 'if-none-match'];
$headers = [];
foreach ($_SERVER as $k => $v) {
    if (str_starts_with($k, 'HTTP_')) {
        $name = strtolower(str_replace('_', '-', substr($k, 5)));
        if (in_array($name, $pass, true)) {
            $headers[] = "$name: $v";
        }
    }
}
if (!empty($_SERVER['CONTENT_TYPE']) && !isset($_SERVER['HTTP_CONTENT_TYPE'])) {
    $headers[] = 'content-type: ' . $_SERVER['CONTENT_TYPE'];
}
if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION']) && empty($_SERVER['HTTP_AUTHORIZATION'])) {
    $headers[] = 'authorization: ' . $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
}
$body = in_array($method, ['GET', 'HEAD'], true) ? null : file_get_contents('php://input');

// Ответ: статус и нужные заголовки, тело — потоком (фото, большие списки).
$keep = ['content-type', 'content-range', 'content-location', 'location', 'cache-control', 'etag', 'last-modified',
         'x-total-count', 'preference-applied'];
$started = false;
$ch = curl_init($upstream . '/' . $path);
curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_ENCODING => '', // принять gzip от Supabase и отдать распакованным
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 90, // распознавание (Pl@ntNet + Gemini) бывает долгим
    CURLOPT_HEADERFUNCTION => function ($ch, string $line) use ($keep) {
        if (preg_match('#^HTTP/\S+\s+(\d{3})#', $line, $m)) {
            http_response_code((int) $m[1]);
        } elseif (str_contains($line, ':')) {
            [$k, $v] = explode(':', $line, 2);
            if (in_array(strtolower(trim($k)), $keep, true)) {
                header(trim($k) . ': ' . trim($v), false);
            }
        }
        return strlen($line);
    },
    CURLOPT_WRITEFUNCTION => function ($ch, string $chunk) use (&$started) {
        $started = true;
        echo $chunk;
        flush();
        return strlen($chunk);
    },
]);
if ($body !== null) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}
curl_exec($ch);
if (curl_errno($ch) !== 0 && !$started) {
    http_response_code(502);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'upstream_unreachable', 'message' => 'Сервер данных временно недоступен']);
}
curl_close($ch);
