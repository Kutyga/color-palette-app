#!/usr/bin/env bash
# Печатает рабочую строку подключения к Supabase из SUPABASE_DB_URL (прямой адрес переводится
# на пулер, см. source_url.py). Пароль из строки скрывается в журнале GitHub Actions.
set -euo pipefail
: "${SUPABASE_DB_URL:?нужен SUPABASE_DB_URL}"
HERE="$(cd "$(dirname "$0")" && pwd)"
PSQL="${PG_BIN:+$PG_BIN/}psql"
pw=$(python3 -c 'import sys, urllib.parse as u; print(u.urlsplit(sys.argv[1].strip()).password or "")' "$SUPABASE_DB_URL")
[ -n "$pw" ] && echo "::add-mask::$pw" >&2
for url in $(python3 "$HERE/source_url.py" "$SUPABASE_DB_URL"); do
  if "$PSQL" "$url" -XAtc 'select 1' >/dev/null 2>&1; then echo "$url"; exit 0; fi
done
echo "Не удалось подключиться к Supabase — проверьте SUPABASE_DB_URL" >&2
exit 1
