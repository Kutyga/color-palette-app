# Переезд на SpaceWeb

Сайт уже выкладывается на хостинг SpaceWeb (`.github/workflows/deploy-spaceweb.yml`), данные пока
в Supabase. Здесь — всё для переноса серверной части на тот же хостинг.

## База (`db/`)

На SpaceWeb PostgreSQL 17, как в Supabase, поэтому схема переносится почти как есть. Чего нет:
ролей `anon`/`authenticated` (создавать роли нельзя) и служебных схем Supabase.

| Файл | Что делает |
|---|---|
| `platform.sql` | Заменители `auth`, `storage`, `vault`, `cron`, `net` и признак пропуска RLS `auth.rls_bypass()` |
| `export-extras.sql` | Из Supabase: пользователи (bcrypt-пароли), метаданные файлов, секреты, задания cron, триггеры на `auth.users`, права ролей API (`api.*_privileges`) |
| `export-policies.sql` | Из Supabase: правила RLS, где роль заменена условием `auth.role()` |
| `filter_dump.py` | Убирает из `pg_dump` правила RLS и публикации Realtime |
| `harden.sql` | Принудительный RLS, правило `rls_bypass`, пропуск для security definer функций |
| `verify.sql` | Проверка после переноса на любых данных |
| `migrate.sh` | Весь перенос по шагам со сверкой числа строк |
| `test-local.sh` | Репетиция на локальном Postgres (в CI): миграции → перенос → `test/rls_test.sql` |

Как работает доступ без ролей: PHP ставит в транзакции `request.jwt.claims`
(`{"sub": "<id>", "role": "authenticated"}`), и правила RLS видят `auth.uid()` и `auth.role()` как в
Supabase. Security definer функции на время работы получают `application_name =
podokonnik-rls-bypass` — по нему правило `rls_bypass` пропускает всё, как postgres в Supabase.
Какие таблицы, колонки и функции доступны из браузера, PHP берёт из `api.*_privileges`.

Запуск: Actions → **db-spaceweb** → Run workflow (галочка «reset» — перенести заново). Нужны
секреты `SUPABASE_DB_URL` и `SPACEWEB_DB_PASSWORD`.
