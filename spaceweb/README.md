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
| `lib/Storage.php` | Фото: загрузка (права — по RLS на `storage.objects`), подписанные ссылки, выдача, удаление |
| `lib/Functions.php` | Функции вместо Edge Functions: `identify-plant` (Pl@ntNet + Gemini, квоты), `news-reader`, `push`, `news-ingest` |
| `lib/WebPush.php` | Web Push без библиотек: шифрование aes128gcm (RFC 8291) и подпись VAPID; ключи — из vault, подписки сохраняются |
| `lib/News.php` | Разбор RSS/Atom и «режим чтения» статьи |
| `lib/Cron.php`, `cron.php` | Планировщик вместо pg_cron/pg_net: задания `cron.job` по расписанию и очередь `net.http_request_queue` |
| `lib/Db.php` | Транзакции от имени пользователя (`request.jwt.claims`) и служебные — с пропуском RLS |
| `.user.ini` | Выключает разбор форм: supabase-js шлёт фото полем без имени, PHP такое теряет |
| `test/run.sh` | Проверка настоящим supabase-js на локальном Postgres (в CI) |

Выкладка — вместе с сайтом (`deploy-spaceweb.yml`): файлы в `public_html/api/`, настройки
(`podokonnik-config.php`, секрет токенов, папка файлов) — рядом с `public_html`, снаружи недоступны.
Нужна версия PHP 8.3 для сайта в панели SpaceWeb.

Фото лежат в `podokonnik-storage` рядом с `public_html`. Из Supabase их переносит шаг «Фото»
в **db-spaceweb** — нужен секрет `SUPABASE_SERVICE_KEY` (служебный ключ из Project Settings → API Keys).

Чат: веб-сокетов на хостинге нет, поэтому, если сайт подключён не к Supabase, новые сообщения
приходят опросом раз в 4 секунды (в фоне — раз в 15), см. `web/src/lib/data/supabase/chat.ts`.

Планировщик запускается раз в минуту из cron в панели SpaceWeb — точную команду печатает выкладка
(шаг «Проверка API»). До переключения сайта он ничего не делает: иначе копия базы дублировала бы
Supabase (push, итоги конкурсов). Включается отметкой `api.live` при переключении.
