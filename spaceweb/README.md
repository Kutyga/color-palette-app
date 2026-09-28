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

## API (`api/`)

PHP 8.3 на хостинге отвечает по тем же адресам, что Supabase, поэтому сайт (supabase-js) переключится
сменой одного адреса: `https://podokonnikapp.ru/api/{auth,rest}/v1/…`.

| Файл | Что делает |
|---|---|
| `index.php`, `.htaccess` | Маршруты, CORS, ошибки в формате Supabase; `/api/health` — проверка после выкладки |
| `lib/Auth.php` | Вход по паролю (bcrypt, пароли из Supabase подходят), продление, регистрация с письмом, выход |
| `lib/Rest.php` | Подмножество PostgREST: выборки с вложениями, фильтры, `or`, сортировка, подсчёт, запись, `rpc` |
| `lib/Schema.php` | Таблицы, связи и права ролей API (`api.*_privileges`) |
| `lib/Db.php` | Транзакции от имени пользователя (`request.jwt.claims`) и служебные — с пропуском RLS |
| `test/run.sh` | Проверка настоящим supabase-js на локальном Postgres (в CI) |

Выкладка — вместе с сайтом (`deploy-spaceweb.yml`): файлы в `public_html/api/`, настройки
(`podokonnik-config.php`, секрет токенов, папка файлов) — рядом с `public_html`, снаружи недоступны.
Нужна версия PHP 8.3 для сайта в панели SpaceWeb.

Ещё не перенесено: хранилище фото (`storage`), серверные функции (`functions`), чат в реальном
времени, задания по расписанию.
