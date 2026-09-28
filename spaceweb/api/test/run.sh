#!/usr/bin/env bash
# Проверка PHP API на локальной машине: перенесённая база (как db/test-local.sh) → php -S →
# настоящий клиент supabase-js из сайта делает те же запросы, что и сайт (api.test.mjs).
set -euo pipefail
source "$(dirname "$0")/../../db/test/lib.sh"
API_PORT="${API_PORT:-8791}"
WORK="$(mktemp -d)"
PHP_PID=""
cleanup() { [ -n "$PHP_PID" ] && kill "$PHP_PID" 2>/dev/null; stop_pg; rm -rf "$WORK"; }
trap cleanup EXIT

start_pg
build_source
create_target
migrate >/dev/null

cat > "$WORK/config.php" <<PHP
<?php
return [
    'db' => ['dsn' => 'pgsql:host=/tmp;port=$PORT;dbname=spaceweb', 'user' => 'spaceweb', 'password' => ''],
    'jwt_secret' => '$(head -c 32 /dev/urandom | base64)',
    'site_url' => 'http://127.0.0.1:$API_PORT',
    'api_url' => 'http://127.0.0.1:$API_PORT',
    'allowed_origins' => [],
    'confirm_email' => true,
    'mail_from' => 'Подоконник <no-reply@example.com>',
    'mail_log' => '$WORK/mail.log',
    'storage_dir' => '$WORK/storage',
];
PHP

echo "== PHP API на 127.0.0.1:$API_PORT"
PODOKONNIK_CONFIG="$WORK/config.php" php -d enable_post_data_reading=0 -S "127.0.0.1:$API_PORT" -t "$ROOT/spaceweb/api" "$ROOT/spaceweb/api/index.php" \
  > "$WORK/php.log" 2>&1 &
PHP_PID=$!
for _ in $(seq 50); do curl -sf "http://127.0.0.1:$API_PORT/health" >/dev/null && break; sleep 0.1; done

dst=(psql "$DST_URL" -X -q -v ON_ERROR_STOP=1 -At)
echo "== До переключения API не отвечает (данные — в Supabase), планировщик молчит"
code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$API_PORT/rest/v1/species?select=id&limit=1" -H "apikey: x")
[ "$code" = 503 ] || { echo "до переключения API должен отвечать 503, а не $code" >&2; exit 1; }
PODOKONNIK_CONFIG="$WORK/config.php" php "$ROOT/spaceweb/api/cron.php" | grep -q "ждёт переключения" \
  || { echo "до переключения планировщик должен молчать" >&2; exit 1; }
"${dst[@]}" -c "create table api.live (switched_at timestamptz not null default now())"

API_URL="http://127.0.0.1:$API_PORT" MAIL_LOG="$WORK/mail.log" node "$ROOT/spaceweb/api/test/api.test.mjs" \
  || { echo "--- журнал PHP ---"; grep -v -E "Accepted|Closing" "$WORK/php.log" | tail -n 40; exit 1; }
node "$ROOT/spaceweb/api/test/webpush.test.mjs"
node "$ROOT/spaceweb/api/test/news.test.mjs"

echo "== Планировщик (cron.php)"
# Вызов своей функции через очередь net — как задание рассылки push из Supabase.
"${dst[@]}" -c "set application_name = 'podokonnik-rls-bypass';
  select net.http_post(url := 'https://old.supabase.co/functions/v1/push',
    headers := jsonb_build_object('x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_send_secret')),
    body := '{\"action\":\"send\"}'::jsonb)" >/dev/null
PODOKONNIK_CONFIG="$WORK/config.php" php "$ROOT/spaceweb/api/cron.php"
jobs=$("${dst[@]}" -c "select string_agg(jobname || '=' || coalesce(last_status, 'не запускалось'), ' ' order by jobname) from cron.job")
queue=$("${dst[@]}" -c "select string_agg(status_code::text || coalesce(':' || error, ''), ' ') from net.http_request_queue")
echo "задания: $jobs; очередь: $queue"
case "$jobs" in *failed*|*не\ запускалось*) echo "задания не выполнились" >&2; exit 1 ;; esac
[ "$queue" = 200 ] || { echo "очередь net не разобрана" >&2; exit 1; }
# Второй запуск в ту же минуту ничего не повторяет.
PODOKONNIK_CONFIG="$WORK/config.php" php "$ROOT/spaceweb/api/cron.php" | grep -q '"jobs":\[\]' || { echo "повторный запуск" >&2; exit 1; }
echo "cron: OK"
