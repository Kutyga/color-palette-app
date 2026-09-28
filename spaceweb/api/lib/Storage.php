<?php
/**
 * Хранилище фото — подмножество Supabase Storage, которым пользуется сайт:
 *   POST/PUT /storage/v1/object/<бакет>/<путь>      — загрузка (x-upsert: true — заменить);
 *   POST     /storage/v1/object/sign/<бакет>        — подписанные ссылки на несколько файлов;
 *   POST     /storage/v1/object/sign/<бакет>/<путь> — одна ссылка;
 *   GET      /storage/v1/object/sign/<бакет>/<путь>?token=… — выдача файла по ссылке;
 *   DELETE   /storage/v1/object/<бакет>             — удаление ({prefixes: [...]}).
 * Кто что может — решают правила RLS на storage.objects (перенесены из Supabase): запись и чтение
 * метаданных идут от имени пользователя. Сами файлы лежат на диске вне папки сайта.
 */
final class Storage
{
    private const DEFAULT_LIMIT = 10 * 1024 * 1024;
    /** Ссылка живёт не меньше заказанного, а срок округлён — одинаковые ссылки кэшируются браузером. */
    private const SIGN_ROUND = 600;

    public static function handle(string $method, string $path): never
    {
        if (preg_match('#^object/sign/([\w-]+)$#', $path, $m) && $method === 'POST') {
            self::signMany($m[1]);
        }
        if (preg_match('#^object/sign/([\w-]+)/(.+)$#', $path, $m)) {
            match ($method) {
                'GET', 'HEAD' => self::download($m[1], self::cleanPath($m[2])),
                'POST' => self::signOne($m[1], self::cleanPath($m[2])),
                default => throw new ApiError(405, 'Method not allowed'),
            };
        }
        if (preg_match('#^object/([\w-]+)/(.+)$#', $path, $m) && in_array($method, ['POST', 'PUT'], true)) {
            self::upload($m[1], self::cleanPath($m[2]), $method === 'PUT' || strtolower(Http::header('x-upsert') ?? '') === 'true');
        }
        if (preg_match('#^object/([\w-]+)$#', $path, $m) && $method === 'DELETE') {
            self::remove($m[1]);
        }
        throw new ApiError(404, 'Not found');
    }

    /** Путь файла: только безопасные символы, без «..» — файл не выйдет за пределы своей папки. */
    private static function cleanPath(string $path): string
    {
        $path = trim(rawurldecode($path), '/');
        if ($path === '' || !preg_match('#^[\w.\-/]+$#', $path) || preg_match('#(^|/)\.\.?(/|$)#', $path) || str_contains($path, '//')) {
            throw new ApiError(400, 'Недопустимое имя файла', 'InvalidKey');
        }
        return $path;
    }

    private static function file(string $bucket, string $path): string
    {
        return rtrim((string) Config::get('storage_dir'), '/') . "/$bucket/$path";
    }

    private static function claimsRequired(): array
    {
        $claims = Auth::claims();
        if (!isset($claims['sub'])) {
            throw new ApiError(401, 'Нужно войти', 'Unauthorized');
        }
        return $claims;
    }

    // --- Загрузка -----------------------------------------------------------------------------

    private static function upload(string $bucket, string $path, bool $upsert): never
    {
        $claims = self::claimsRequired();
        [$data, $mime] = self::incomingFile();
        $b = Db::service(fn (PDO $db) => Db::row($db, 'select file_size_limit, allowed_mime_types from storage.buckets where id = ?', [$bucket]));
        if ($b === null) {
            throw new ApiError(404, 'Bucket not found', 'NoSuchBucket');
        }
        if (strlen($data) > (int) ($b['file_size_limit'] ?? self::DEFAULT_LIMIT)) {
            throw new ApiError(413, 'Файл слишком большой', 'EntityTooLarge');
        }
        $allowed = $b['allowed_mime_types'] ? str_getcsv(trim($b['allowed_mime_types'], '{}')) : [];
        if ($allowed !== [] && !in_array($mime, $allowed, true)) {
            throw new ApiError(415, "Тип файла $mime не разрешён", 'InvalidMimeType');
        }
        $meta = json_encode(['size' => strlen($data), 'mimetype' => $mime, 'eTag' => '"' . md5($data) . '"',
                             'cacheControl' => 'max-age=3600', 'lastModified' => gmdate('c')]);
        $target = self::file($bucket, $path);

        // Метаданные — от имени пользователя (правила RLS), файл — в той же транзакции: не записался — откат.
        $id = Db::asUser($claims, function (PDO $db) use ($bucket, $path, $claims, $meta, $upsert, $data, $target) {
            try {
                $id = Db::value($db,
                    'insert into storage.objects (bucket_id, name, owner, metadata) values (?, ?, ?, ?::jsonb)'
                    . ($upsert ? ' on conflict (bucket_id, name) do update set metadata = excluded.metadata,
                                   owner = excluded.owner, updated_at = now()' : '')
                    . ' returning id',
                    [$bucket, $path, $claims['sub'], $meta]);
            } catch (PDOException $e) {
                $err = Db::toApiError($e, false);
                throw $err->errorCode === '23505'
                    ? new ApiError(409, 'The resource already exists', 'Duplicate')
                    : new ApiError($err->status === 400 ? 403 : $err->status, $err->getMessage(), 'Unauthorized');
            }
            if (!is_dir(dirname($target)) && !mkdir(dirname($target), 0700, true) && !is_dir(dirname($target))) {
                throw new ApiError(500, 'Не удалось сохранить файл');
            }
            $tmp = $target . '.' . bin2hex(random_bytes(4)) . '.tmp';
            if (file_put_contents($tmp, $data) !== strlen($data) || !rename($tmp, $target)) {
                @unlink($tmp);
                throw new ApiError(500, 'Не удалось сохранить файл');
            }
            return $id;
        });
        Http::json(200, ['Id' => $id, 'Key' => "$bucket/$path"]);
    }

    /**
     * Файл из запроса: сырое тело или multipart/form-data (supabase-js шлёт Blob полем без имени,
     * такие поля PHP в $_FILES не кладёт — поэтому разбор форм выключен в .user.ini и делается здесь).
     * @return array{0: string, 1: string} содержимое и тип
     */
    private static function incomingFile(): array
    {
        $type = Http::header('Content-Type') ?? 'application/octet-stream';
        if (!empty($_FILES)) {
            $f = reset($_FILES);
            return [(string) file_get_contents($f['tmp_name']), $f['type'] ?: 'application/octet-stream'];
        }
        $raw = (string) file_get_contents('php://input');
        if (!preg_match('/^multipart\/form-data;.*boundary="?([^";]+)"?/i', $type, $m)) {
            return [$raw, strtolower(trim(explode(';', $type)[0]))];
        }
        foreach (explode('--' . $m[1], $raw) as $part) {
            [$head, $body] = array_pad(explode("\r\n\r\n", ltrim($part, "\r\n"), 2), 2, null);
            if ($body === null || !preg_match('/filename="/i', $head)) {
                continue;
            }
            $mime = preg_match('/^Content-Type:\s*([^\r\n;]+)/mi', $head, $t) ? strtolower(trim($t[1])) : 'application/octet-stream';
            return [substr($body, 0, -2), $mime];
        }
        if ($raw === '') {
            throw new ApiError(400, 'Файл не получен: на хостинге должен быть выключен разбор форм (.user.ini)', 'InvalidRequest');
        }
        throw new ApiError(400, 'В запросе нет файла', 'InvalidRequest');
    }

    // --- Ссылки и выдача ----------------------------------------------------------------------

    private static function signMany(string $bucket): never
    {
        $body = Http::body() ?? [];
        $paths = array_values(array_filter((array) ($body['paths'] ?? []), 'is_string'));
        $expires = max(1, min(7 * 86400, (int) ($body['expiresIn'] ?? 3600)));
        $visible = self::visible($bucket, $paths);
        Http::json(200, array_map(fn ($p) => isset($visible[$p])
            ? ['error' => null, 'path' => $p, 'signedURL' => self::signedUrl($bucket, $p, $expires)]
            : ['error' => 'Either the object does not exist or you do not have access to it', 'path' => $p, 'signedURL' => null],
            $paths));
    }

    private static function signOne(string $bucket, string $path): never
    {
        $expires = max(1, min(7 * 86400, (int) ((Http::body() ?? [])['expiresIn'] ?? 3600)));
        if (!isset(self::visible($bucket, [$path])[$path])) {
            throw new ApiError(404, 'Object not found', 'not_found');
        }
        Http::json(200, ['signedURL' => self::signedUrl($bucket, $path, $expires)]);
    }

    /** Какие из путей пользователь вправе видеть — по правилам RLS на storage.objects. */
    private static function visible(string $bucket, array $paths): array
    {
        if ($paths === []) {
            return [];
        }
        $claims = Auth::claims();
        $names = Db::asUser($claims, fn (PDO $db) => Db::run($db,
            'select name from storage.objects where bucket_id = ? and name = any(?::text[])',
            [$bucket, '{' . implode(',', array_map(fn ($p) => '"' . addcslashes($p, '"\\') . '"', $paths)) . '}'])
            ->fetchAll(PDO::FETCH_COLUMN));
        return array_fill_keys($names, true);
    }

    private static function signedUrl(string $bucket, string $path, int $expires): string
    {
        $exp = (int) (ceil((time() + $expires) / self::SIGN_ROUND) * self::SIGN_ROUND);
        $token = Jwt::sign(['url' => "$bucket/$path", 'iat' => $exp - $expires, 'exp' => $exp]);
        return "/object/sign/$bucket/$path?token=$token";
    }

    private static function download(string $bucket, string $path): never
    {
        $claims = Jwt::verify((string) ($_GET['token'] ?? ''));
        if ($claims === null || ($claims['url'] ?? '') !== "$bucket/$path") {
            throw new ApiError(400, 'Ссылка недействительна или устарела', 'InvalidJWT');
        }
        $file = self::file($bucket, $path);
        if (!is_file($file)) {
            throw new ApiError(404, 'Object not found', 'not_found');
        }
        $meta = Db::service(fn (PDO $db) => Db::value($db, 'select metadata::text from storage.objects where bucket_id = ? and name = ?', [$bucket, $path]));
        $mime = json_decode((string) $meta, true)['mimetype'] ?? 'application/octet-stream';
        $etag = '"' . md5_file($file) . '"';
        header('Content-Type: ' . $mime);
        header('Cache-Control: private, max-age=3600');
        header('ETag: ' . $etag);
        header('X-Content-Type-Options: nosniff');
        if ((Http::header('If-None-Match') ?? '') === $etag) {
            Http::empty(304);
        }
        header('Content-Length: ' . filesize($file));
        if ($_SERVER['REQUEST_METHOD'] !== 'HEAD') {
            readfile($file);
        }
        exit;
    }

    // --- Удаление -----------------------------------------------------------------------------

    private static function remove(string $bucket): never
    {
        $claims = self::claimsRequired();
        $paths = array_map([self::class, 'cleanPath'], array_filter((array) ((Http::body() ?? [])['prefixes'] ?? []), 'is_string'));
        $deleted = $paths === [] ? [] : Db::asUser($claims, fn (PDO $db) => Db::run($db,
            'delete from storage.objects where bucket_id = ? and name = any(?::text[]) returning name, metadata',
            [$bucket, '{' . implode(',', array_map(fn ($p) => '"' . addcslashes($p, '"\\') . '"', $paths)) . '}'])
            ->fetchAll());
        foreach ($deleted as $row) {
            @unlink(self::file($bucket, $row['name']));
        }
        Http::json(200, array_map(fn ($r) => ['bucket_id' => $bucket, 'name' => $r['name']], $deleted));
    }
}
