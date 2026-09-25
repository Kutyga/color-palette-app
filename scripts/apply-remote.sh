#!/usr/bin/env bash
# Применяет миграции (и по желанию seed) к базе Supabase по строке подключения.
#
#   DATABASE_URL='postgresql://postgres:<пароль>@db.<project-ref>.supabase.co:5432/postgres' \
#     scripts/apply-remote.sh [--seed]
#
# Строку берите в Supabase Dashboard → Project Settings → Database → Connection string.
# Скрипт не хранит пароль; не коммитьте его и не вставляйте в чаты.
# Миграции не идемпотентны: запускайте на чистом проекте один раз, дальше — только новые файлы
# (или используйте `supabase db push`, который сам ведёт учёт применённых миграций).
set -euo pipefail

: "${DATABASE_URL:?Задайте DATABASE_URL}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "migration: $(basename "$f")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done

if [ "${1:-}" = "--seed" ]; then
  echo "seed: supabase/seed.sql"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/seed.sql"
fi
echo "done"
