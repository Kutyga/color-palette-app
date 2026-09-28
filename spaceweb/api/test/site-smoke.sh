#!/usr/bin/env bash
# Сайт целиком на своём сервере: сборка с адресом /api, PHP-API на перенесённой базе,
# браузер (Playwright) проходит по страницам вошедшим пользователем — ошибок API быть не должно.
set -euo pipefail
source "$(dirname "$0")/../../db/test/lib.sh"
SITE_PORT="${SITE_PORT:-8792}"
WORK="$(mktemp -d)"
PHP_PID=""
cleanup() { [ -n "$PHP_PID" ] && kill "$PHP_PID" 2>/dev/null; stop_pg; rm -rf "$WORK"; }
trap cleanup EXIT

start_pg
build_source
create_target
migrate >/dev/null
psql "$DST_URL" -X -q -c "create table api.live (switched_at timestamptz default now(), source text)"

echo "== Сборка сайта с адресом /api"
(cd "$ROOT/web" && NEXT_PUBLIC_SUPABASE_URL=/api NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=podokonnik npm run -s build >/dev/null)
cp -r "$ROOT/web/out" "$WORK/site"
cp -r "$ROOT/spaceweb/api" "$WORK/site/api"
cat > "$WORK/router.php" <<'PHP'
<?php
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if ($path === '/api' || str_starts_with($path, '/api/')) {
    require $_SERVER['DOCUMENT_ROOT'] . '/api/index.php';
    return true;
}
return false;
PHP
cat > "$WORK/config.php" <<PHP
<?php
return [
    'db' => ['dsn' => 'pgsql:host=/tmp;port=$PORT;dbname=spaceweb', 'user' => 'spaceweb', 'password' => ''],
    'jwt_secret' => '$(head -c 32 /dev/urandom | base64)',
    'site_url' => 'http://127.0.0.1:$SITE_PORT', 'api_url' => 'http://127.0.0.1:$SITE_PORT/api',
    'allowed_origins' => [], 'confirm_email' => false, 'mail_from' => 'x <x@example.com>',
    'storage_dir' => '$WORK/storage',
];
PHP
# Файлы под записи storage.objects — как после переноса фото (в тестовой базе есть только записи).
psql "$DST_URL" -XAt -c "set application_name = 'podokonnik-rls-bypass'; select bucket_id || '/' || name from storage.objects" | while IFS= read -r key; do
  mkdir -p "$WORK/storage/$(dirname "$key")" && printf '\xff\xd8\xff\xd9' > "$WORK/storage/$key"
done
PODOKONNIK_CONFIG="$WORK/config.php" php -d enable_post_data_reading=0 -S "127.0.0.1:$SITE_PORT" -t "$WORK/site" "$WORK/router.php" \
  > "$WORK/php.log" 2>&1 &
PHP_PID=$!
for _ in $(seq 50); do curl -sf "http://127.0.0.1:$SITE_PORT/api/health" >/dev/null && break; sleep 0.1; done
SITE="http://127.0.0.1:$SITE_PORT" node "$ROOT/spaceweb/api/test/site-smoke.mjs"
