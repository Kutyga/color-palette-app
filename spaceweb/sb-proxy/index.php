<?php
/**
 * Запасной путь к Supabase через свой домен: podokonnikapp.ru/sb/{auth,rest,storage,functions}/v1/…
 * Часть российских операторов не пропускает *.supabase.co; тогда сайт (web/src/lib/net.ts) шлёт
 * запросы сюда, а хостинг пересылает их в Supabase и отдаёт ответ как есть.
 * Пересылает только в свой проект Supabase (адрес — upstream.php, его пишет выкладка) и только
 * пути API — это не открытый прокси. Веб-сокеты (Realtime) не проходят: чат в этом режиме опрашивает.
 */
declare(strict_types=1);

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
