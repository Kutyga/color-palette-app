<?php
/**
 * Подключение к базе и транзакции «от имени» пользователя.
 *
 * Ролей на SpaceWeb нет (см. spaceweb/db/platform.sql): кто спрашивает, база узнаёт из настройки
 * транзакции request.jwt.claims — её читают auth.uid() и auth.role() в правилах RLS.
 * Служебные действия (вход, проверка пароля) выполняются с пропуском мимо RLS.
 */
final class Db
{
    private static ?PDO $pdo = null;
    public const BYPASS = 'podokonnik-rls-bypass';

    public static function pdo(): PDO
    {
        if (self::$pdo === null) {
            $c = Config::get('db');
            self::$pdo = new PDO($c['dsn'], $c['user'], $c['password'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_STRINGIFY_FETCHES => false,
            ]);
            self::$pdo->exec("set application_name = 'podokonnik-api'; set timezone = 'UTC'");
        }
        return self::$pdo;
    }

    /**
     * Выполняет $fn в транзакции от имени пользователя: $claims — данные токена или null (аноним).
     * @template T
     * @param callable(PDO): T $fn
     * @return T
     */
    public static function asUser(?array $claims, callable $fn): mixed
    {
        $pdo = self::pdo();
        $pdo->beginTransaction();
        try {
            self::run($pdo, "select set_config('request.jwt.claims', ?, true), set_config('statement_timeout', '15s', true)",
                      [json_encode($claims ?? ['role' => 'anon'])]);
            $result = $fn($pdo);
            $pdo->commit();
            return $result;
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    /**
     * Служебная транзакция с пропуском мимо RLS — как service_role в Supabase.
     * @template T
     * @param callable(PDO): T $fn
     * @return T
     */
    public static function service(callable $fn): mixed
    {
        return self::asUser(['role' => 'service_role'], function (PDO $pdo) use ($fn) {
            $pdo->exec("select set_config('application_name', '" . self::BYPASS . "', true)");
            return $fn($pdo);
        });
    }

    /**
     * Запрос с параметрами «?» или именованными «:p1». Нумерованные $1 PDO не понимает — молча
     * подставил бы NULL.
     * false PDO передал бы пустой строкой, поэтому логические значения — 't'/'f'.
     */
    public static function run(PDO $pdo, string $sql, array $params = []): PDOStatement
    {
        $stmt = $pdo->prepare($sql);
        // Именованные параметры (:p1) нельзя повторять в одном запросе — каждый используется один раз.
        $params = array_map(static fn ($v) => is_bool($v) ? ($v ? 't' : 'f') : $v, $params);
        $stmt->execute($params);
        return $stmt;
    }

    /** Одно значение из первой строки. */
    public static function value(PDO $pdo, string $sql, array $params = []): mixed
    {
        $v = self::run($pdo, $sql, $params)->fetchColumn();
        return $v === false ? null : $v;
    }

    /** Первая строка или null. */
    public static function row(PDO $pdo, string $sql, array $params = []): ?array
    {
        $row = self::run($pdo, $sql, $params)->fetch();
        return $row === false ? null : $row;
    }

    /** Ошибка PostgreSQL → ответ в формате PostgREST: {code, message, details, hint} и статус HTTP. */
    public static function toApiError(PDOException $e, bool $anon): ApiError
    {
        $state = (string) ($e->errorInfo[0] ?? $e->getCode());
        $text = (string) ($e->errorInfo[2] ?? $e->getMessage());
        $field = static function (string $label) use ($text): ?string {
            return preg_match('/^' . $label . ':\s+(.*)$/m', $text, $m) ? trim($m[1]) : null;
        };
        $message = $field('ERROR') ?? trim(strtok($text, "\n"));
        $status = match (true) {
            $state === '42501' => $anon ? 401 : 403,
            in_array($state, ['23503', '23505'], true) => 409,
            in_array($state, ['42883', '42P01'], true) => 404,
            $state === '57014' => 504,
            str_starts_with($state, '22'), str_starts_with($state, '23'), $state === 'P0001', str_starts_with($state, '42') => 400,
            default => 500,
        };
        if ($status === 500) {
            // Текст внутренней ошибки (адрес сервера базы, имя пользователя) — только в журнал, не наружу.
            error_log('podokonnik-api: ' . $text);
            return new ApiError(500, 'Внутренняя ошибка сервера', $state);
        }
        return new ApiError($status, $message, $state, $field('DETAIL'), $field('HINT'));
    }
}
