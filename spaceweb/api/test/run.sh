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
PODOKONNIK_CONFIG="$WORK/config.php" php -S "127.0.0.1:$API_PORT" -t "$ROOT/spaceweb/api" "$ROOT/spaceweb/api/index.php" \
  > "$WORK/php.log" 2>&1 &
PHP_PID=$!
for _ in $(seq 50); do curl -sf "http://127.0.0.1:$API_PORT/health" >/dev/null && break; sleep 0.1; done

API_URL="http://127.0.0.1:$API_PORT" MAIL_LOG="$WORK/mail.log" node "$ROOT/spaceweb/api/test/api.test.mjs" \
  || { echo "--- журнал PHP ---"; tail -n 40 "$WORK/php.log"; exit 1; }
