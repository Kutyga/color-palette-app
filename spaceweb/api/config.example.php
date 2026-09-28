<?php
// Настройки API «Подоконника». Настоящий файл — ~/podokonnik-config.php на хостинге (вне папки
// сайта); его пишет выкладка из секретов GitHub. В репозитории — только этот образец.
return [
    // База SpaceWeb (PostgreSQL 17).
    'db' => [
        'dsn' => 'pgsql:host=pg4.sweb.ru;port=5433;dbname=kutygama_podokon',
        'user' => 'kutygama_podokon',
        'password' => '',
    ],
    // Секрет подписи токенов входа (HS256), 32+ случайных байт. Смена — выход всех пользователей.
    // На хостинге — отдельный файл, его один раз создаёт выкладка (jwt_secret_file).
    'jwt_secret' => '',
    'jwt_secret_file' => __DIR__ . '/podokonnik-jwt.secret',
    // Адрес сайта: сюда ведут ссылки из писем, и только сюда разрешён возврат после входа.
    'site_url' => 'https://podokonnikapp.ru',
    // Адрес самого API — для ссылок подтверждения в письмах.
    'api_url' => 'https://podokonnikapp.ru/api',
    // Откуда ещё можно обращаться к API из браузера (CORS), кроме site_url.
    'allowed_origins' => [],
    // Подтверждать почту письмом (true) или сразу пускать после регистрации (false, для проверки).
    'confirm_email' => true,
    'mail_from' => 'Подоконник <no-reply@podokonnikapp.ru>',
    // Где лежат файлы (фото) — вне папки сайта.
    'storage_dir' => __DIR__ . '/podokonnik-storage',
];
