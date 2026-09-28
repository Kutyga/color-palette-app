#!/usr/bin/env bash
# Фото из хранилища Supabase → хостинг SpaceWeb (podokonnik-storage рядом с public_html).
# Скачивает служебным ключом всё из storage.objects и докладывает rsync; файлы, уже загруженные
# на хостинг, не удаляются.
#   SRC_URL — база Supabase; SERVICE_KEY, SUPABASE_URL — ключ и адрес проекта;
#   SSH_HOST, SSH_USER, SSH_PORT, SSHPASS, TARGET_DIR — доступ к хостингу.
set -euo pipefail
: "${SRC_URL:?}" "${SERVICE_KEY:?}" "${SUPABASE_URL:?}" "${SSH_HOST:?}" "${SSH_USER:?}" "${TARGET_DIR:?}"
PSQL="${PG_BIN:+$PG_BIN/}psql"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Новые ключи Supabase (sb_secret_…) — только в apikey; старые (JWT) — ещё и в Authorization.
auth=(-H "apikey: $SERVICE_KEY")
[ "$(tr -cd . <<< "$SERVICE_KEY" | wc -c)" = 2 ] && auth+=(-H "Authorization: Bearer $SERVICE_KEY")
ok=0; fail=0
while IFS= read -r key; do
  [ -n "$key" ] || continue
  mkdir -p "$WORK/files/$(dirname "$key")"
  if curl -sf --max-time 60 "${auth[@]}" "${SUPABASE_URL%/}/storage/v1/object/$key" -o "$WORK/files/$key"; then
    ok=$((ok + 1))
  else
    fail=$((fail + 1)); echo "не скачан: $key"
  fi
done < <("$PSQL" "$SRC_URL" -XAtc "select bucket_id || '/' || name from storage.objects order by 1")
echo "скачано $ok, ошибок $fail"
mkdir -p "$WORK/files"
install -m 700 -d ~/.ssh
ssh-keyscan -p "${SSH_PORT:-22}" -H "$SSH_HOST" >> ~/.ssh/known_hosts 2>/dev/null
STORAGE_DIR="$(dirname "$TARGET_DIR")/podokonnik-storage"
rsync -rltz --chmod=D700,F600 -e "sshpass -e ssh -p ${SSH_PORT:-22} -o PubkeyAuthentication=no" \
  "$WORK/files/" "$SSH_USER@$SSH_HOST:$STORAGE_DIR/"
echo "на хостинге: $STORAGE_DIR"
[ "$fail" = 0 ] || { echo "Не все фото скачались" >&2; exit 1; }
