#!/usr/bin/env bash
# Перенос базы «Подоконника» из Supabase в PostgreSQL на SpaceWeb.
#
#   SRC_URL — строка подключения к Supabase (в GitHub — через пулер, см. source_url.py);
#   DST_URL — строка подключения к базе SpaceWeb (владелец базы, без прав суперпользователя);
#   RESET=yes — удалить на SpaceWeb всё, что создано прошлым переносом, и загрузить заново.
#               Без него перенос откажется работать с непустой базой. После переключения сайта
#               на SpaceWeb (таблица api.live) перенос не запустится вовсе — там уже живые данные.
#
# Порядок: служебные схемы → таблицы и функции → пользователи, файлы, секреты, расписание →
# данные → индексы, ключи и триггеры → правила RLS → принудительный RLS и пропуск для
# security definer. Триггеры и внешние ключи появляются после данных: загрузка не будит
# уведомления и не зависит от порядка таблиц.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
: "${SRC_URL:?нужен SRC_URL}" "${DST_URL:?нужен DST_URL}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

PG_BIN="${PG_BIN:-}"
# Предупреждения о «циклических внешних ключах» не про нас: ключи создаются после данных.
pg_dump() { "${PG_BIN:+$PG_BIN/}pg_dump" "$@" 2> >(grep -vE '^pg_dump: (warning: there are circular|detail:|hint:)' >&2); }
psql() { command "${PG_BIN:+$PG_BIN/}psql" "$@"; }
dst() { psql "$DST_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }

step() { echo "== $*"; }

step "Проверка базы SpaceWeb"
if [ "$(dst -At -c "select to_regclass('api.live') is not null")" = t ]; then
  echo "Сайт уже работает на этой базе (api.live) — перенос из Supabase затёр бы живые данные." >&2
  exit 1
fi
existing=$(dst -At -c "select count(*) from pg_tables where schemaname in ('public', 'private', 'auth')")
if [ "$existing" != 0 ]; then
  if [ "${RESET:-}" = yes ]; then
    step "Очистка: удаляю всё, что принадлежит $(dst -At -c 'select current_user')"
    dst -c "drop owned by current_user cascade"
  else
    echo "В базе уже есть таблицы ($existing). Чтобы перенести заново, запустите с RESET=yes." >&2
    exit 1
  fi
fi

DUMP_OPTS=(--no-owner --no-privileges --no-publications --no-subscriptions --no-security-labels
           --no-tablespaces --no-table-access-method --schema=public --schema=private)

step "Выгрузка из Supabase"
pg_dump "$SRC_URL" "${DUMP_OPTS[@]}" --section=pre-data | python3 "$HERE/filter_dump.py" > "$WORK/pre.sql"
pg_dump "$SRC_URL" "${DUMP_OPTS[@]}" --section=post-data | python3 "$HERE/filter_dump.py" > "$WORK/post.sql"
pg_dump "$SRC_URL" "${DUMP_OPTS[@]}" --data-only > "$WORK/data.sql"
psql "$SRC_URL" -X -q -v ON_ERROR_STOP=1 -At -f "$HERE/export-extras.sql" > "$WORK/extras.sql"
psql "$SRC_URL" -X -q -v ON_ERROR_STOP=1 -At -f "$HERE/export-policies.sql" > "$WORK/policies.sql"
echo "таблицы и функции: $(grep -c '^CREATE' "$WORK/pre.sql") объектов, правил RLS: $(grep -c '^create policy' "$WORK/policies.sql")"

step "Служебные схемы (auth, storage, vault, cron, net)"
dst -f "$HERE/platform.sql" >/dev/null
step "Таблицы и функции"
dst -f "$WORK/pre.sql" >/dev/null
step "Пользователи, файлы, секреты, расписание, права API"
dst -f "$WORK/extras.sql" >/dev/null
step "Данные"
dst -f "$WORK/data.sql" >/dev/null
step "Индексы, ключи, триггеры"
dst -f "$WORK/post.sql" >/dev/null
step "Правила RLS"
dst -f "$WORK/policies.sql" >/dev/null
step "Принудительный RLS и пропуск для security definer"
dst -f "$HERE/harden.sql" >/dev/null

step "Сверка числа строк"
tables=$(psql "$SRC_URL" -XAt -c "select string_agg(format('%I.%I', schemaname, relname), ' ' order by schemaname, relname)
                                  from pg_stat_user_tables where schemaname in ('public', 'private')")
count_sql=""
for t in $tables; do count_sql+="select '$t', count(*) from $t union all "; done
count_sql+="select 'auth.users', count(*) from auth.users union all select 'storage.objects', count(*) from storage.objects"
psql "$SRC_URL" -XAt -F ' ' -c "$count_sql" | sort > "$WORK/src.counts"
dst -At -F ' ' -c "set application_name = 'podokonnik-rls-bypass'; $count_sql" | sort > "$WORK/dst.counts"
if diff "$WORK/src.counts" "$WORK/dst.counts" > "$WORK/counts.diff"; then
  echo "совпадает: $(wc -l < "$WORK/src.counts") таблиц, $(awk '{s += $2} END {print s}' "$WORK/src.counts") строк"
else
  echo "Расхождения (слева Supabase, справа SpaceWeb):" >&2
  cat "$WORK/counts.diff" >&2
  exit 1
fi
step "Проверка правил доступа"
dst -f "$HERE/verify.sql"
step "Готово"
