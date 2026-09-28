<?php
/**
 * Планировщик «Подоконника»: раз в минуту из cron в панели SpaceWeb —
 *   /usr/bin/php8.3 /home/k/kutygama/Podokonnik.app/public_html/api/cron.php
 * Из браузера недоступен (только командная строка).
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/lib/Http.php';
require __DIR__ . '/lib/Jwt.php';
require __DIR__ . '/lib/Db.php';
require __DIR__ . '/lib/Auth.php';
require __DIR__ . '/lib/Fetch.php';
require __DIR__ . '/lib/WebPush.php';
require __DIR__ . '/lib/News.php';
require __DIR__ . '/lib/Functions.php';
require __DIR__ . '/lib/Cron.php';

// Один запуск за раз: если прошлый ещё идёт (медленная лента новостей), этот пропускаем.
$lock = fopen(sys_get_temp_dir() . '/podokonnik-cron.lock', 'c');
if (!flock($lock, LOCK_EX | LOCK_NB)) {
    exit(0);
}
try {
    // Пока сайт работает на Supabase, здесь лишь копия базы: рассылка push и итоги конкурсов
    // отсюда задублировали бы Supabase. Планировщик включается переключением сайта (api.live).
    if (Db::service(fn (PDO $db) => Db::value($db, "select to_regclass('api.live') is not null")) !== true) {
        echo "Сайт ещё на Supabase — планировщик ждёт переключения (api.live)\n";
        exit(0);
    }
    echo json_encode(Cron::run(), JSON_UNESCAPED_UNICODE), "\n";
} catch (Throwable $e) {
    fwrite(STDERR, 'podokonnik cron: ' . $e->getMessage() . "\n");
    exit(1);
}
