<?php
/**
 * Вход и регистрация — то подмножество Supabase Auth (GoTrue), которым пользуется сайт:
 *   POST /auth/v1/token?grant_type=password | refresh_token
 *   POST /auth/v1/signup, GET /auth/v1/verify (ссылка из письма)
 *   GET  /auth/v1/user, POST /auth/v1/logout
 * Пароли — bcrypt, как в Supabase: перенесённые пользователи входят со старыми паролями.
 * Токен доступа живёт час, долгий токен меняется при каждом продлении (в базе — только его хеш).
 */
final class Auth
{
    private const ACCESS_TTL = 3600;
    private const REFRESH_TTL = 60 * 86400;
    /** Сколько секунд после замены старый долгий токен ещё принимается — вкладки продлевают вход одновременно. */
    private const REFRESH_REUSE = 10;
    private const CONFIRM_TTL = 86400;

    public static function handle(string $method, string $path): never
    {
        match ([$method, $path]) {
            ['POST', 'token'] => self::token(),
            ['POST', 'signup'] => self::signup(),
            ['GET', 'verify'] => self::verify(),
            ['GET', 'user'] => Http::json(200, self::userJson(self::currentUserId())),
            ['POST', 'logout'] => self::logout(),
            default => throw new ApiError(404, 'Not found', 'not_found'),
        };
    }

    /** Данные токена из заголовка Authorization или null (аноним). Неверный токен — ошибка 401. */
    public static function claims(): ?array
    {
        $header = Http::header('Authorization') ?? '';
        if (!preg_match('/^Bearer\s+(\S+)$/i', $header, $m)) {
            return null;
        }
        $claims = Jwt::verify($m[1]);
        if ($claims === null) {
            // Ключ сайта (apikey) тоже приходит как Bearer — он не JWT и означает анонима.
            if (substr_count($m[1], '.') !== 2) {
                return null;
            }
            throw new ApiError(401, 'JWT expired', 'PGRST301');
        }
        return $claims;
    }

    private static function currentUserId(): string
    {
        $claims = self::claims();
        if (!isset($claims['sub'])) {
            throw new ApiError(401, 'Invalid JWT', 'bad_jwt');
        }
        return $claims['sub'];
    }

    // --- Вход -------------------------------------------------------------------------------

    private static function token(): never
    {
        $body = Http::body() ?? [];
        match ($_GET['grant_type'] ?? '') {
            'password' => self::passwordGrant((string) ($body['email'] ?? ''), (string) ($body['password'] ?? '')),
            'refresh_token' => self::refreshGrant((string) ($body['refresh_token'] ?? '')),
            default => throw new ApiError(400, 'Unsupported grant type', 'validation_failed'),
        };
    }

    private static function passwordGrant(string $email, string $password): never
    {
        $email = self::normalizeEmail($email);
        self::limit('signin', $email . '|' . self::ip(), 10, 300);
        $user = Db::service(fn (PDO $db) => Db::row($db,
            'select id, encrypted_password, email_confirmed_at, banned_until from auth.users
              where lower(email) = ? and deleted_at is null', [$email]));
        // Проверка пароля занимает одно и то же время, есть такой пользователь или нет.
        $hash = $user['encrypted_password'] ?? '$2y$10$' . str_repeat('x', 53);
        if (!password_verify($password, $hash) || $user === null) {
            throw new ApiError(400, 'Invalid login credentials', 'invalid_credentials');
        }
        if ($user['email_confirmed_at'] === null) {
            throw new ApiError(400, 'Email not confirmed', 'email_not_confirmed');
        }
        if ($user['banned_until'] !== null && strtotime($user['banned_until']) > time()) {
            throw new ApiError(400, 'User is banned', 'user_banned');
        }
        Http::json(200, self::session($user['id']));
    }

    private static function refreshGrant(string $token): never
    {
        if ($token === '') {
            throw new ApiError(400, 'Invalid Refresh Token: Refresh Token Not Found', 'refresh_token_not_found');
        }
        $userId = Db::service(function (PDO $db) use ($token) {
            $row = Db::row($db,
                'select user_id, revoked_at, expires_at from auth.refresh_tokens where token_hash = ? for update',
                [hash('sha256', $token)]);
            if ($row === null || strtotime($row['expires_at']) < time()
                || ($row['revoked_at'] !== null && strtotime($row['revoked_at']) < time() - self::REFRESH_REUSE)) {
                return null;
            }
            Db::run($db, 'update auth.refresh_tokens set revoked_at = coalesce(revoked_at, now()) where token_hash = ?', [hash('sha256', $token)]);
            return $row['user_id'];
        });
        if ($userId === null) {
            throw new ApiError(400, 'Invalid Refresh Token: Refresh Token Not Found', 'refresh_token_not_found');
        }
        Http::json(200, self::session($userId));
    }

    /** Новая сессия: токен доступа, долгий токен и пользователь — как ответ Supabase Auth. */
    private static function session(string $userId): array
    {
        $refresh = bin2hex(random_bytes(32));
        $user = Db::service(function (PDO $db) use ($userId, $refresh) {
            Db::run($db, "insert into auth.refresh_tokens (token_hash, user_id, expires_at)
                          values (?, ?, now() + make_interval(secs => ?))", [hash('sha256', $refresh), $userId, self::REFRESH_TTL]);
            Db::run($db, 'update auth.users set last_sign_in_at = now() where id = ?', [$userId]);
            // Старые отозванные и просроченные токены больше не нужны.
            Db::run($db, "delete from auth.refresh_tokens where user_id = ?
                            and (expires_at < now() or revoked_at < now() - interval '1 day')", [$userId]);
            return self::userRow($db, $userId);
        });
        $now = time();
        $access = Jwt::sign([
            'aud' => 'authenticated',
            'exp' => $now + self::ACCESS_TTL,
            'iat' => $now,
            'sub' => $userId,
            'email' => $user['email'],
            'role' => 'authenticated',
            'session_id' => hash('sha256', $refresh),
            'user_metadata' => $user['user_metadata'],
            'app_metadata' => $user['app_metadata'],
        ]);
        return [
            'access_token' => $access,
            'token_type' => 'bearer',
            'expires_in' => self::ACCESS_TTL,
            'expires_at' => $now + self::ACCESS_TTL,
            'refresh_token' => $refresh,
            'user' => $user,
        ];
    }

    // --- Регистрация --------------------------------------------------------------------------

    private static function signup(): never
    {
        $body = Http::body() ?? [];
        $email = self::normalizeEmail((string) ($body['email'] ?? ''));
        $password = (string) ($body['password'] ?? '');
        $data = is_array($body['data'] ?? null) ? $body['data'] : [];
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new ApiError(400, 'Unable to validate email address: invalid format', 'email_address_invalid');
        }
        if (strlen($password) < 6) {
            throw new ApiError(422, 'Password should be at least 6 characters.', 'weak_password');
        }
        self::limit('signup', self::ip(), 5, 3600);
        $confirm = (bool) Config::get('confirm_email');
        $token = bin2hex(random_bytes(24));

        $userId = Db::service(function (PDO $db) use ($email, $password, $data, $confirm, $token) {
            $existing = Db::row($db, 'select id, email_confirmed_at from auth.users where lower(email) = ? and deleted_at is null', [$email]);
            if ($existing !== null) {
                if ($existing['email_confirmed_at'] !== null) {
                    throw new ApiError(422, 'User already registered', 'user_already_exists');
                }
                // Не подтвердил — отправим письмо ещё раз, пароль не меняем.
                Db::run($db, 'update auth.users set confirmation_token = ?, confirmation_sent_at = now() where id = ?', [hash('sha256', $token), $existing['id']]);
                return $existing['id'];
            }
            try {
                $db->exec('savepoint signup');
                return Db::value($db,
                    'insert into auth.users (email, encrypted_password, raw_user_meta_data, raw_app_meta_data,
                                             email_confirmed_at, confirmation_token, confirmation_sent_at)
                     values (?, ?, ?, ?, ?, ?, ?)
                     returning id',
                    [$email, password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]), json_encode((object) $data),
                     json_encode(['provider' => 'email', 'providers' => ['email']]),
                     $confirm ? null : gmdate('c'), $confirm ? hash('sha256', $token) : null, $confirm ? gmdate('c') : null]);
            } catch (PDOException $e) {
                // Как Supabase: ошибка триггера профиля (например, занятое имя) — «Database error saving new user».
                error_log('podokonnik-api signup: ' . $e->getMessage());
                throw new ApiError(500, 'Database error saving new user', 'unexpected_failure');
            }
        });

        if (!$confirm) {
            Http::json(200, self::session($userId));
        }
        self::sendConfirmation($email, $token, (string) ($_GET['redirect_to'] ?? ''));
        Http::json(200, Db::service(fn (PDO $db) => self::userRow($db, $userId)));
    }

    private static function sendConfirmation(string $email, string $token, string $redirectTo): void
    {
        $link = rtrim((string) Config::get('api_url'), '/') . '/auth/v1/verify?' . http_build_query([
            'token' => $token, 'type' => 'signup', 'redirect_to' => self::safeRedirect($redirectTo),
        ]);
        $subject = '=?UTF-8?B?' . base64_encode('Подтвердите почту — Подоконник') . '?=';
        $text = "Здравствуйте!\n\nЧтобы закончить регистрацию в «Подоконнике», откройте ссылку:\n$link\n\n"
              . "Ссылка действует сутки. Если вы не регистрировались — просто удалите это письмо.\n";
        $headers = implode("\r\n", [
            'From: ' . self::encodeFrom((string) Config::get('mail_from')),
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
        ]);
        // Для проверки на локальной машине письма можно складывать в файл вместо отправки.
        if ($log = Config::get('mail_log')) {
            file_put_contents($log, "To: $email\n$text\n", FILE_APPEND);
            return;
        }
        if (!@mail($email, $subject, $text, $headers)) {
            error_log("podokonnik-api: письмо на $email не отправлено");
        }
    }

    /** Ссылка из письма: подтверждаем почту и возвращаем на сайт уже вошедшим (токены — в #фрагменте). */
    private static function verify(): never
    {
        $redirect = self::safeRedirect((string) ($_GET['redirect_to'] ?? ''));
        $token = (string) ($_GET['token'] ?? '');
        $userId = $token === '' ? null : Db::service(fn (PDO $db) => Db::value($db,
            "update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()),
                    confirmation_token = null, updated_at = now()
              where confirmation_token = ? and confirmation_sent_at > now() - make_interval(secs => ?)
             returning id", [hash('sha256', $token), self::CONFIRM_TTL]));
        if ($userId === null) {
            Http::redirect($redirect . '#' . http_build_query([
                'error' => 'access_denied', 'error_code' => 'otp_expired',
                'error_description' => 'Email link is invalid or has expired',
            ]));
        }
        $s = self::session($userId);
        Http::redirect($redirect . '#' . http_build_query([
            'access_token' => $s['access_token'], 'expires_at' => $s['expires_at'], 'expires_in' => $s['expires_in'],
            'refresh_token' => $s['refresh_token'], 'token_type' => 'bearer', 'type' => 'signup',
        ]));
    }

    private static function logout(): never
    {
        $claims = self::claims();
        if (isset($claims['sub'])) {
            Db::service(function (PDO $db) use ($claims) {
                if (($_GET['scope'] ?? 'global') === 'global') {
                    Db::run($db, 'update auth.refresh_tokens set revoked_at = now() - interval \'1 hour\'
                                   where user_id = ? and revoked_at is null', [$claims['sub']]);
                } else {
                    Db::run($db, 'update auth.refresh_tokens set revoked_at = now() - interval \'1 hour\'
                                   where token_hash = ?', [$claims['session_id'] ?? '']);
                }
            });
        }
        Http::empty(204);
    }

    // --- Помощники ----------------------------------------------------------------------------

    private static function userJson(string $userId): array
    {
        $user = Db::service(fn (PDO $db) => self::userRow($db, $userId));
        if ($user === null) {
            throw new ApiError(401, 'User from sub claim in JWT does not exist', 'user_not_found');
        }
        return $user;
    }

    /** Пользователь в формате Supabase Auth. */
    private static function userRow(PDO $db, string $userId): ?array
    {
        $r = Db::row($db, 'select id, email, email_confirmed_at, last_sign_in_at, raw_user_meta_data, raw_app_meta_data,
                                  created_at, updated_at from auth.users where id = ?', [$userId]);
        if ($r === null) {
            return null;
        }
        $iso = static fn (?string $t) => $t === null ? null : gmdate('Y-m-d\TH:i:s\Z', strtotime($t));
        return [
            'id' => $r['id'],
            'aud' => 'authenticated',
            'role' => 'authenticated',
            'email' => $r['email'],
            'email_confirmed_at' => $iso($r['email_confirmed_at']),
            'confirmed_at' => $iso($r['email_confirmed_at']),
            'last_sign_in_at' => $iso($r['last_sign_in_at']),
            'app_metadata' => json_decode($r['raw_app_meta_data'] ?? '{}', true) ?: (object) [],
            'user_metadata' => json_decode($r['raw_user_meta_data'] ?? '{}', true) ?: (object) [],
            'identities' => [],
            'created_at' => $iso($r['created_at']),
            'updated_at' => $iso($r['updated_at']),
            'is_anonymous' => false,
        ];
    }

    /** Возврат после письма — только на свой сайт. */
    private static function safeRedirect(string $url): string
    {
        $site = rtrim((string) Config::get('site_url'), '/');
        $allowed = array_merge([$site], (array) Config::get('allowed_origins'));
        foreach ($allowed as $origin) {
            if ($url !== '' && ($url === $origin || str_starts_with($url, rtrim($origin, '/') . '/'))) {
                return $url;
            }
        }
        return $site . '/login/';
    }

    private static function normalizeEmail(string $email): string
    {
        return mb_strtolower(trim($email));
    }

    private static function encodeFrom(string $from): string
    {
        return preg_match('/^(.*?)\s*<(.+)>$/u', $from, $m)
            ? '=?UTF-8?B?' . base64_encode($m[1]) . '?= <' . $m[2] . '>'
            : $from;
    }

    private static function ip(): string
    {
        return (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    }

    /** Не больше $max попыток за $seconds по ключу — иначе 429, как в Supabase. */
    private static function limit(string $kind, string $key, int $max, int $seconds): void
    {
        $count = Db::service(function (PDO $db) use ($kind, $key, $seconds) {
            Db::run($db, "delete from auth.attempts where at < now() - interval '1 day'");
            Db::run($db, 'insert into auth.attempts (kind, key) values (?, ?)', [$kind, $key]);
            return (int) Db::value($db,
                'select count(*) from auth.attempts where kind = ? and key = ? and at > now() - make_interval(secs => ?)',
                [$kind, $key, $seconds]);
        });
        if ($count > $max) {
            throw new ApiError(429, 'Request rate limit reached', 'over_request_rate_limit');
        }
    }
}
