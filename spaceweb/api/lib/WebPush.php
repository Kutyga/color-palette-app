<?php
/**
 * Web Push без сторонних библиотек: шифрование aes128gcm (RFC 8291) и подпись VAPID (RFC 8292)
 * средствами OpenSSL из PHP. Ключи VAPID — те же, что были у Supabase (перенесены в vault), поэтому
 * подписки браузеров продолжают работать.
 */
final class WebPush
{
    /** Префикс DER для открытого ключа P-256 (SubjectPublicKeyInfo) — дальше 65 байт точки. */
    private const SPKI_PREFIX = '3059301306072a8648ce3d020106082a8648ce3d030107034200';

    public static function b64u(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    public static function unb64u(string $data): string
    {
        return (string) base64_decode(strtr($data, '-_', '+/') . str_repeat('=', (4 - strlen($data) % 4) % 4));
    }

    /** Открытый ключ P-256 (65 байт, 0x04||x||y) → ключ OpenSSL. */
    private static function publicKey(string $point): OpenSSLAsymmetricKey
    {
        $pem = "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode(hex2bin(self::SPKI_PREFIX) . $point), 64, "\n")
             . "-----END PUBLIC KEY-----\n";
        $key = openssl_pkey_get_public($pem);
        if ($key === false) {
            throw new RuntimeException('неверный открытый ключ подписки');
        }
        return $key;
    }

    /** Закрытый ключ P-256 из 32 байт d и открытой точки → ключ OpenSSL (ECPrivateKey, RFC 5915). */
    private static function privateKey(string $d, string $point): OpenSSLAsymmetricKey
    {
        $der = hex2bin('307702010104') . "\x20" . $d . hex2bin('a00a06082a8648ce3d030107a144034200') . $point;
        $pem = "-----BEGIN EC PRIVATE KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END EC PRIVATE KEY-----\n";
        $key = openssl_pkey_get_private($pem);
        if ($key === false) {
            throw new RuntimeException('неверный закрытый ключ VAPID');
        }
        return $key;
    }

    /** Открытая точка ключа: 0x04||x||y. */
    private static function point(OpenSSLAsymmetricKey $key): string
    {
        $ec = openssl_pkey_get_details($key)['ec'];
        return "\x04" . str_pad($ec['x'], 32, "\0", STR_PAD_LEFT) . str_pad($ec['y'], 32, "\0", STR_PAD_LEFT);
    }

    /** Новая пара VAPID-ключей в формате web-push (base64url): открытый 65 байт, закрытый 32. */
    public static function generateKeys(): array
    {
        $key = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1']);
        $d = str_pad(openssl_pkey_get_details($key)['ec']['d'], 32, "\0", STR_PAD_LEFT);
        return ['publicKey' => self::b64u(self::point($key)), 'privateKey' => self::b64u($d)];
    }

    /** Заголовок Authorization для push-сервиса: vapid t=<JWT ES256>, k=<открытый ключ>. */
    public static function vapidAuth(string $endpoint, string $subject, string $publicKey, string $privateKey): string
    {
        $u = parse_url($endpoint);
        $aud = $u['scheme'] . '://' . $u['host'] . (isset($u['port']) ? ':' . $u['port'] : '');
        $input = self::b64u(json_encode(['typ' => 'JWT', 'alg' => 'ES256'])) . '.'
               . self::b64u(json_encode(['aud' => $aud, 'exp' => time() + 12 * 3600, 'sub' => $subject]));
        $key = self::privateKey(self::unb64u($privateKey), self::unb64u($publicKey));
        if (!openssl_sign($input, $der, $key, OPENSSL_ALGO_SHA256)) {
            throw new RuntimeException('подпись VAPID не удалась');
        }
        return 'vapid t=' . $input . '.' . self::b64u(self::derToRaw($der)) . ', k=' . $publicKey;
    }

    /** Подпись ECDSA из DER (SEQUENCE{r, s}) в 64 байта r||s, как требует JWT. */
    private static function derToRaw(string $der): string
    {
        $offset = 2 + (ord($der[1]) & 0x80 ? ord($der[1]) & 0x7f : 0);
        $out = '';
        for ($i = 0; $i < 2; $i++) {
            $len = ord($der[$offset + 1]);
            $int = ltrim(substr($der, $offset + 2, $len), "\0");
            $out .= str_pad($int, 32, "\0", STR_PAD_LEFT);
            $offset += 2 + $len;
        }
        return $out;
    }

    /** Шифрует сообщение для подписки (aes128gcm, одна запись). */
    public static function encrypt(string $payload, string $p256dh, string $authSecret): string
    {
        $uaPublic = self::unb64u($p256dh);
        $auth = self::unb64u($authSecret);
        if (strlen($uaPublic) !== 65 || strlen($auth) !== 16) {
            throw new RuntimeException('неверные ключи подписки');
        }
        $local = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1']);
        $asPublic = self::point($local);
        $shared = openssl_pkey_derive(self::publicKey($uaPublic), $local, 32);
        if ($shared === false) {
            throw new RuntimeException('ECDH не удался');
        }
        $shared = str_pad($shared, 32, "\0", STR_PAD_LEFT);
        $ikm = hash_hkdf('sha256', $shared, 32, "WebPush: info\0" . $uaPublic . $asPublic, $auth);
        $salt = random_bytes(16);
        $cek = hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\0", $salt);
        $nonce = hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\0", $salt);
        $cipher = openssl_encrypt($payload . "\x02", 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag);
        return $salt . pack('N', 4096) . chr(65) . $asPublic . $cipher . $tag;
    }

    /**
     * Отправка одного уведомления. Возвращает HTTP-статус push-сервиса
     * (201 — принято; 404/410 — подписки больше нет).
     */
    public static function send(array $sub, string $payload, array $vapid, string $subject, int $ttl): int
    {
        $body = self::encrypt($payload, $sub['p256dh'], $sub['auth']);
        $res = Fetch::request('POST', $sub['endpoint'], [
            'Authorization' => self::vapidAuth($sub['endpoint'], $subject, $vapid['publicKey'], $vapid['privateKey']),
            'Content-Encoding' => 'aes128gcm',
            'Content-Type' => 'application/octet-stream',
            'TTL' => (string) $ttl,
            'Urgency' => 'high',
        ], $body, 15);
        return $res['status'];
    }
}
