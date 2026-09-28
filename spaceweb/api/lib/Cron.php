<?php
/**
 * Планировщик вместо pg_cron и pg_net. Раз в минуту (cron в панели SpaceWeb → cron.php):
 *   1. выполняет задания cron.job, у которых подошло время (расписание — как у pg_cron);
 *   2. разбирает очередь net.http_request_queue: вызовы своих функций (push, news-ingest)
 *      выполняет здесь же, остальные адреса — обычным HTTP-запросом.
 * Задания работают с пропуском RLS — как pg_cron в Supabase.
 */
final class Cron
{
    public static function run(?int $now = null): array
    {
        $now ??= time();
        $report = ['jobs' => [], 'requests' => []];
        $jobs = Db::service(fn (PDO $db) => Db::run($db,
            'select jobid, jobname, schedule, command, last_run_at from cron.job where active order by jobid')->fetchAll());
        foreach ($jobs as $job) {
            $due = self::lastDue($job['schedule'], $now);
            if ($due === null || ($job['last_run_at'] !== null && strtotime($job['last_run_at']) >= $due)) {
                continue;
            }
            [$status, $message] = ['succeeded', null];
            try {
                Db::service(fn (PDO $db) => $db->exec($job['command']));
            } catch (Throwable $e) {
                [$status, $message] = ['failed', mb_substr($e->getMessage(), 0, 500)];
                error_log("podokonnik cron {$job['jobname']}: $message");
            }
            Db::service(fn (PDO $db) => Db::run($db,
                'update cron.job set last_run_at = to_timestamp(?), last_status = ?, last_message = ? where jobid = ?',
                [$now, $status, $message, $job['jobid']]));
            $report['jobs'][$job['jobname'] ?? $job['jobid']] = $status;
        }
        $report['requests'] = self::drainQueue();
        return $report;
    }

    /** Отправка накопившихся запросов net.http_post. */
    private static function drainQueue(): array
    {
        $out = [];
        $rows = Db::service(fn (PDO $db) => Db::run($db,
            'select id, url, headers::text as headers, body::text as body, timeout_milliseconds from net.http_request_queue
              where sent_at is null order by id limit 50')->fetchAll());
        foreach ($rows as $r) {
            $headers = json_decode($r['headers'] ?? '{}', true) ?: [];
            $body = json_decode($r['body'] ?? 'null', true);
            [$status, $error] = [0, null];
            try {
                if (preg_match('#/functions/v1/(push|news-ingest)$#', $r['url'], $m)) {
                    // Свои функции — без HTTP, но с той же проверкой секрета.
                    if (!Functions::cronSecretOk($headers['x-cron-secret'] ?? null, $m[1] === 'push' ? 'push' : 'news')) {
                        throw new RuntimeException('forbidden');
                    }
                    $result = $m[1] === 'push'
                        ? (($body['action'] ?? '') === 'send' ? Functions::sendPush() : [])
                        : Functions::ingestNews();
                    [$status, $error] = [200, null];
                    $out[] = [$m[1] => $result];
                } else {
                    $res = Fetch::request('POST', $r['url'], $headers, json_encode($body), max(1, intdiv((int) $r['timeout_milliseconds'], 1000)));
                    $status = $res['status'];
                }
            } catch (Throwable $e) {
                $error = mb_substr($e->getMessage(), 0, 500);
            }
            Db::service(fn (PDO $db) => Db::run($db,
                'update net.http_request_queue set sent_at = now(), status_code = ?, error = ? where id = ?', [$status, $error, $r['id']]));
        }
        Db::service(fn (PDO $db) => Db::run($db, "delete from net.http_request_queue where sent_at < now() - interval '7 days'"));
        return $out;
    }

    /** Последний момент по расписанию не позже $now (поиск на сутки назад) или null. */
    public static function lastDue(string $schedule, int $now): ?int
    {
        $f = preg_split('/\s+/', trim($schedule));
        if (count($f) !== 5) {
            return null;
        }
        [$min, $hour, $dom, $mon, $dow] = [self::field($f[0], 0, 59), self::field($f[1], 0, 23), self::field($f[2], 1, 31),
                                           self::field($f[3], 1, 12), self::field($f[4], 0, 7)];
        if (isset($dow[7])) {
            $dow[0] = true;
        }
        $domAny = $f[2] === '*';
        $dowAny = $f[4] === '*';
        $t = $now - $now % 60;
        for ($i = 0; $i < 1440; $i++, $t -= 60) {
            [$mi, $h, $d, $mo, $w] = array_map('intval', explode(' ', gmdate('i G j n w', $t)));
            if (!isset($min[$mi], $hour[$h], $mon[$mo])) {
                continue;
            }
            // Как в cron: если заданы и день месяца, и день недели — подходит любой из них.
            $dayOk = $domAny || $dowAny ? isset($dom[$d]) && isset($dow[$w]) : isset($dom[$d]) || isset($dow[$w]);
            if ($dayOk) {
                return $t;
            }
        }
        return null;
    }

    /** Поле расписания: звёздочка, шаг «звёздочка/n», диапазон a-b и a-b/n, списки через запятую. */
    private static function field(string $spec, int $lo, int $hi): array
    {
        $set = [];
        foreach (explode(',', $spec) as $part) {
            [$range, $step] = array_pad(explode('/', $part, 2), 2, '1');
            [$a, $b] = $range === '*' ? [$lo, $hi] : array_pad(array_map('intval', explode('-', $range, 2)), 2, null);
            $b ??= str_contains($part, '/') ? $hi : $a;
            for ($v = max($lo, $a); $v <= min($hi, $b); $v += max(1, (int) $step)) {
                $set[$v] = true;
            }
        }
        return $set;
    }
}
