<?php
/**
 * Ответы и ошибки. Формат ошибок — как у Supabase: PostgREST отдаёт {code, message, details, hint},
 * Auth — {code, error_code, msg}. Библиотека supabase-js в браузере читает именно их.
 */

final class ApiError extends Exception
{
    public function __construct(
        public readonly int $status,
        string $message,
        public readonly string $errorCode = '',
        public readonly ?string $details = null,
        public readonly ?string $hint = null,
    ) {
        parent::__construct($message);
    }
}

final class Http
{
    /** Тело ответа: готовый JSON-текст (как его собрала база) или значение PHP. */
    public static function json(int $status, mixed $body, array $headers = []): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        foreach ($headers as $name => $value) {
            header("$name: $value");
        }
        if ($body !== null && $_SERVER['REQUEST_METHOD'] !== 'HEAD') {
            echo is_string($body) ? $body : json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
        exit;
    }

    public static function empty(int $status = 204, array $headers = []): never
    {
        http_response_code($status);
        foreach ($headers as $name => $value) {
            header("$name: $value");
        }
        exit;
    }

    public static function redirect(string $url): never
    {
        header('Location: ' . $url, true, 303);
        exit;
    }

    /** Тело запроса как JSON; пустое — null. */
    public static function body(): mixed
    {
        $raw = file_get_contents('php://input');
        if ($raw === '' || $raw === false) {
            return null;
        }
        try {
            return json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new ApiError(400, 'Тело запроса — не JSON', 'PGRST102');
        }
    }

    /** Заголовок запроса без учёта регистра. */
    public static function header(string $name): ?string
    {
        $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
        $value = $_SERVER[$key] ?? ($name === 'Authorization' ? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? null) : null);
        if ($value === null && in_array($name, ['Content-Type', 'Content-Length'], true)) {
            $value = $_SERVER[strtoupper(str_replace('-', '_', $name))] ?? null;
        }
        return $value;
    }

    /**
     * Параметры строки запроса без искажений: PHP в $_GET заменяет точки в именах на «_»,
     * а PostgREST передаёт фильтры по вложенным таблицам как «plants.owner_id». Повторы сохраняются.
     * @return list<array{0: string, 1: string}>
     */
    public static function query(): array
    {
        $pairs = [];
        foreach (explode('&', $_SERVER['QUERY_STRING'] ?? '') as $part) {
            if ($part === '') {
                continue;
            }
            [$k, $v] = array_pad(explode('=', $part, 2), 2, '');
            $pairs[] = [urldecode($k), urldecode($v)];
        }
        return $pairs;
    }
}
