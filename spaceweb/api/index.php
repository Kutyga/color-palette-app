<?php
/**
 * API «Подоконника» на хостинге SpaceWeb — замена Supabase с теми же адресами, чтобы сайт
 * (supabase-js) работал без переделки: https://podokonnikapp.ru/api/{auth,rest,storage,functions}/v1/…
 * Настройки — ~/Podokonnik.app/podokonnik-config.php (см. config.example.php).
 */
declare(strict_types=1);

require __DIR__ . '/lib/Http.php';
require __DIR__ . '/lib/Jwt.php';
require __DIR__ . '/lib/Db.php';
require __DIR__ . '/lib/Schema.php';
require __DIR__ . '/lib/Auth.php';
require __DIR__ . '/lib/Rest.php';
require __DIR__ . '/lib/Storage.php';
require __DIR__ . '/lib/Fetch.php';
require __DIR__ . '/lib/WebPush.php';
require __DIR__ . '/lib/News.php';
require __DIR__ . '/lib/Functions.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$uri = (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
// Адрес папки API от корня сайта (на хостинге — «/api»). По SCRIPT_NAME нельзя: встроенный сервер
// PHP для адресов вида «…/фото.jpg» подставляет туда сам адрес.
$root = realpath((string) ($_SERVER['DOCUMENT_ROOT'] ?? '')) ?: '';
$here = realpath(__DIR__) ?: __DIR__;
$base = $root !== '' && str_starts_with($here, $root)
    ? rtrim(str_replace('\\', '/', substr($here, strlen($root))), '/')
    : rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
$path = trim(substr($uri, strlen($base)), '/');
$area = explode('/', $path, 2)[0];

try {
    cors();
    if ($method === 'OPTIONS') {
        Http::empty(204);
    }
    if (preg_match('#^(auth|rest|storage|functions)/v1/(.+)$#', $path, $m)) {
        // Пока сайт работает на Supabase (нет отметки api.live), эта копия базы — только резерв:
        // старые открытые вкладки не должны писать в неё и терять данные.
        if (Db::value(Db::pdo(), "select to_regclass('api.live') is not null") !== true) {
            throw new ApiError(503, 'Сайт обновился — перезагрузите страницу', 'site_moved');
        }
        match ($m[1]) {
            'auth' => Auth::handle($method, $m[2]),
            'rest' => Rest::handle($method, $m[2]),
            'storage' => Storage::handle($method, $m[2]),
            'functions' => Functions::handle($method, $m[2]),
        };
    }
    if ($path === '' || $path === 'health') {
        // Проверка после выкладки: версия PHP, драйвер PostgreSQL, связь с базой.
        $health = ['php' => PHP_VERSION, 'pdo_pgsql' => extension_loaded('pdo_pgsql'), 'db' => false,
                   // Загрузка фото: разбор форм должен быть выключен (.user.ini), иначе файл из supabase-js теряется.
                   'uploads' => !filter_var(ini_get('enable_post_data_reading'), FILTER_VALIDATE_BOOLEAN)];
        $health['db'] = $health['pdo_pgsql'] && Db::value(Db::pdo(), 'select 1') === 1;
        Http::json($health['db'] ? 200 : 503, ['ok' => $health['db']] + $health);
    }
    throw new ApiError(404, 'Not found', 'not_found');
} catch (ApiError $e) {
    fail($area, $e);
} catch (PDOException $e) {
    fail($area, Db::toApiError($e, true));
} catch (Throwable $e) {
    error_log('podokonnik-api: ' . $e);
    fail($area, new ApiError(500, 'Внутренняя ошибка сервера', 'unexpected_failure'));
}

/** Ошибка в формате той части Supabase, к которой обращались. */
function fail(string $area, ApiError $e): never
{
    if ($area === 'storage') {
        Http::json($e->status, ['statusCode' => (string) $e->status, 'error' => $e->errorCode ?: 'Error', 'message' => $e->getMessage()]);
    }
    if ($area === 'auth') {
        Http::json($e->status, ['code' => $e->status, 'error_code' => $e->errorCode, 'msg' => $e->getMessage()]);
    }
    Http::json($e->status, ['code' => $e->errorCode, 'message' => $e->getMessage(), 'details' => $e->details, 'hint' => $e->hint]);
}

/** Браузер может обращаться к API только со своего сайта (и из списка allowed_origins). */
function cors(): void
{
    $origin = Http::header('Origin');
    if ($origin === null) {
        return;
    }
    $allowed = array_map(fn ($o) => rtrim((string) $o, '/'),
        array_merge([Config::get('site_url')], (array) Config::get('allowed_origins')));
    $originHost = rtrim($origin, '/');
    if (!in_array($originHost, array_map(fn ($o) => preg_replace('#^(https?://[^/]+).*$#', '$1', $o), $allowed), true)) {
        return;
    }
    header("Access-Control-Allow-Origin: $origin");
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: GET, HEAD, POST, PATCH, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: authorization, apikey, content-type, prefer, accept, range, x-client-info, '
         . 'x-supabase-api-version, accept-profile, content-profile, x-upsert, cache-control');
    header('Access-Control-Expose-Headers: Content-Range, Content-Location, Location');
    header('Access-Control-Max-Age: 86400');
}
