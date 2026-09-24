#!/usr/bin/env bash
# Применяет миграции Supabase и seed к временному локальному Postgres и прогоняет дымовой тест.
# Требуется Postgres 15+ (initdb, pg_ctl, psql). Если initdb не в PATH, задайте PG_BIN.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | tail -1)")}"
DATA="$(mktemp -d)"
PORT="${PGPORT:-54329}"

# pg_ctl не запускается от root — в контейнерах работаем от пользователя postgres.
if [ "$(id -u)" = 0 ]; then
  RUN=(runuser -u postgres --)
  chown postgres "$DATA"
else
  RUN=()
fi

cleanup() {
  "${RUN[@]}" "$PG_BIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$DATA"
}
trap cleanup EXIT

"${RUN[@]}" "$PG_BIN/initdb" -D "$DATA" -U postgres --auth=trust --encoding=UTF8 --locale=C.UTF-8 >/dev/null
"${RUN[@]}" "$PG_BIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp -c listen_addresses=''" -l "$DATA/server.log" -w start >/dev/null \
  || { cat "$DATA/server.log"; exit 1; }

PSQL=(psql -h /tmp -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -f "$ROOT/supabase/tests/supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "migration: $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
"${PSQL[@]}" -f "$ROOT/supabase/seed.sql"
"${PSQL[@]}" -f "$ROOT/supabase/tests/smoke_test.sql"
