# Общее для локальных проверок (db/test-local.sh, api/test/run.sh): временный Postgres,
# «Supabase» из миграций и дымового теста, база «как на SpaceWeb» и перенос в неё.
# Использование: source lib.sh; start_pg; build_source; create_target; migrate.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
DBDIR="$ROOT/spaceweb/db"
PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | tail -1)")}"
PORT="${PGPORT:-54339}"
PGDATA_DIR="$(mktemp -d)"

if [ "$(id -u)" = 0 ]; then RUN=(runuser -u postgres --); chown postgres "$PGDATA_DIR"; else RUN=(); fi

stop_pg() { "${RUN[@]}" "$PG_BIN/pg_ctl" -D "$PGDATA_DIR" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$PGDATA_DIR"; }

start_pg() {
  "${RUN[@]}" "$PG_BIN/initdb" -D "$PGDATA_DIR" -U postgres --auth=trust --encoding=UTF8 --locale=C.UTF-8 >/dev/null
  "${RUN[@]}" "$PG_BIN/pg_ctl" -D "$PGDATA_DIR" -o "-p $PORT -k /tmp -c listen_addresses=''" -l "$PGDATA_DIR/server.log" -w start >/dev/null \
    || { cat "$PGDATA_DIR/server.log"; exit 1; }
  export SRC_URL="host=/tmp port=$PORT dbname=postgres user=postgres"
  export DST_URL="host=/tmp port=$PORT dbname=spaceweb user=spaceweb"
  export PG_BIN
}

build_source() {
  local src=(psql "$SRC_URL" -X -q -v ON_ERROR_STOP=1)
  echo "== «Supabase»: миграции, seed, дымовой тест"
  "${src[@]}" -f "$ROOT/supabase/tests/supabase_stub.sql"
  for f in "$ROOT"/supabase/migrations/*.sql; do "${src[@]}" -f "$f" >/dev/null; done
  "${src[@]}" -f "$ROOT/supabase/seed.sql" >/dev/null
  "${src[@]}" -f "$ROOT/supabase/tests/smoke_test.sql" >/dev/null
  "${src[@]}" -c "reset role" -f "$DBDIR/test/source_extras.sql" >/dev/null
}

create_target() {
  echo "== «SpaceWeb»: база с обычным владельцем"
  psql "$SRC_URL" -X -q -v ON_ERROR_STOP=1 -c "create role spaceweb login nocreaterole nocreatedb" \
    -c "create database spaceweb owner spaceweb"
}

migrate() { bash "$DBDIR/migrate.sh"; }
