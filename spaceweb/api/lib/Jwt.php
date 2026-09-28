<?php
/** Токены входа: JWT с подписью HS256, как у Supabase Auth. */
final class Jwt
{
    public static function sign(array $payload): string
    {
        $segments = [self::b64(json_encode(['alg' => 'HS256', 'typ' => 'JWT'])), self::b64(json_encode($payload))];
        $segments[] = self::b64(hash_hmac('sha256', implode('.', $segments), self::secret(), true));
        return implode('.', $segments);
    }

    /** Данные токена или null, если подпись не сходится или срок вышел. */
    public static function verify(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }
        $expected = self::b64(hash_hmac('sha256', $parts[0] . '.' . $parts[1], self::secret(), true));
        if (!hash_equals($expected, $parts[2])) {
            return null;
        }
        $header = json_decode(self::unb64($parts[0]), true);
        $payload = json_decode(self::unb64($parts[1]), true);
        if (($header['alg'] ?? '') !== 'HS256' || !is_array($payload) || ($payload['exp'] ?? 0) < time()) {
            return null;
        }
        return $payload;
    }

    private static function secret(): string
    {
        $secret = (string) Config::get('jwt_secret');
        // На хостинге секрет лежит отдельным файлом: его создаёт первая выкладка, дальше он не меняется.
        if ($secret === '' && is_file($file = (string) Config::get('jwt_secret_file'))) {
            $secret = trim((string) file_get_contents($file));
        }
        if (strlen($secret) < 32) {
            throw new ApiError(500, 'Не задан jwt_secret');
        }
        return $secret;
    }

    private static function b64(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function unb64(string $data): string
    {
        return (string) base64_decode(strtr($data, '-_', '+/'));
    }
}

final class Config
{
    private static ?array $values = null;

    public static function get(string $key): mixed
    {
        if (self::$values === null) {
            $path = getenv('PODOKONNIK_CONFIG') ?: dirname(__DIR__, 3) . '/podokonnik-config.php';
            if (!is_file($path)) {
                throw new ApiError(500, 'Нет файла настроек API');
            }
            self::$values = require $path;
        }
        return self::$values[$key] ?? null;
    }
}
