#!/usr/bin/env bash
# Проверка переноса на локальном Postgres: «Supabase» из миграций и дымового теста →
# база, как на SpaceWeb (владелец без суперпользователя и без права создавать роли) →
# migrate.sh → rls_test.sql. Повторный перенос с RESET=yes тоже проверяется.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HERE="$ROOT/spaceweb/db"
PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | tail -1)")}"
DATA="$(mktemp -d)"
PORT="${PGPORT:-54339}"

if [ "$(id -u)" = 0 ]; then RUN=(runuser -u postgres --); chown postgres "$DATA"; else RUN=(); fi
cleanup() { "${RUN[@]}" "$PG_BIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT

"${RUN[@]}" "$PG_BIN/initdb" -D "$DATA" -U postgres --auth=trust --encoding=UTF8 --locale=C.UTF-8 >/dev/null
"${RUN[@]}" "$PG_BIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp -c listen_addresses=''" -l "$DATA/server.log" -w start >/dev/null \
  || { cat "$DATA/server.log"; exit 1; }

src=(psql -h /tmp -p "$PORT" -U postgres -d postgres -X -q -v ON_ERROR_STOP=1)
echo "== «Supabase»: миграции, seed, дымовой тест"
"${src[@]}" -f "$ROOT/supabase/tests/supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do "${src[@]}" -f "$f" >/dev/null; done
"${src[@]}" -f "$ROOT/supabase/seed.sql" >/dev/null
"${src[@]}" -f "$ROOT/supabase/tests/smoke_test.sql" >/dev/null
"${src[@]}" -c "reset role" -f "$HERE/test/source_extras.sql"

echo "== «SpaceWeb»: база с обычным владельцем"
"${src[@]}" -c "create role spaceweb login nocreaterole nocreatedb" -c "create database spaceweb owner spaceweb"

export SRC_URL="host=/tmp port=$PORT dbname=postgres user=postgres"
export DST_URL="host=/tmp port=$PORT dbname=spaceweb user=spaceweb"
export PG_BIN
bash "$HERE/migrate.sh"
psql "$DST_URL" -X -q -f "$HERE/test/rls_test.sql"

echo "== Повторный перенос (RESET=yes)"
RESET=yes bash "$HERE/migrate.sh" | tail -n 3
psql "$DST_URL" -X -q -f "$HERE/test/rls_test.sql"
