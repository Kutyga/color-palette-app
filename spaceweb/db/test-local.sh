#!/usr/bin/env bash
# Проверка переноса на локальном Postgres: «Supabase» из миграций и дымового теста →
# база, как на SpaceWeb (владелец без суперпользователя и без права создавать роли) →
# migrate.sh → rls_test.sql. Повторный перенос с RESET=yes тоже проверяется.
set -euo pipefail
source "$(dirname "$0")/test/lib.sh"
trap stop_pg EXIT

start_pg
build_source
create_target
migrate
psql "$DST_URL" -X -q -f "$DBDIR/test/rls_test.sql"

echo "== Повторный перенос (RESET=yes)"
RESET=yes migrate | tail -n 3
psql "$DST_URL" -X -q -f "$DBDIR/test/rls_test.sql"
