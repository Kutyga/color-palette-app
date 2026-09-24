# Мой сад — мобильное приложение (Flutter, iOS + Android)

Коллекция растений, напоминания о поливе, база знаний, лента постов и новостей, достижения.
Архитектура и дизайн — в [docs/plant-app](../docs/plant-app/ARCHITECTURE.md).

| Сегодня | Коллекция | Растение | Лента | Новости | Достижения |
|---|---|---|---|---|---|
| ![](../docs/plant-app/screens/1_today.png) | ![](../docs/plant-app/screens/3_collection.png) | ![](../docs/plant-app/screens/4_plant.png) | ![](../docs/plant-app/screens/5_feed.png) | ![](../docs/plant-app/screens/6_news.png) | ![](../docs/plant-app/screens/8_achievements.png) |

## Быстрый старт (демо-режим, без сервера)

```bash
cd mobile
flutter pub get
flutter run            # данные в памяти, заполнены примером
```

## Подключение к Supabase

1. Проект `intskfwuljzaaghoaqfx` уже развёрнут: применены все миграции из `supabase/migrations`
   (имена файлов совпадают с версиями в истории миграций проекта) и `seed.sql`.
   Для нового проекта примените миграции и стартовые данные (один раз, на чистой базе):
   ```bash
   DATABASE_URL='postgresql://postgres:<пароль>@db.<project-ref>.supabase.co:5432/postgres' \
     scripts/apply-remote.sh --seed
   ```
   или через Supabase CLI: `supabase link --project-ref <ref> && supabase db push`, затем выполнить
   `supabase/seed.sql` в SQL Editor.
2. Создайте `mobile/config/dev.json` по образцу `config/example.json` (файл в `.gitignore`):
   ```json
   { "SUPABASE_URL": "https://<project-ref>.supabase.co", "SUPABASE_PUBLISHABLE_KEY": "sb_publishable_..." }
   ```
3. Запуск: `flutter run --dart-define-from-file=config/dev.json`.

Publishable-ключ предназначен для клиента — доступ к данным ограничивают RLS-политики.
Секретный ключ (`service_role`) и пароль базы в приложение и репозиторий не попадают никогда.

## База знаний

67 популярных комнатных растений (ароидные, фикусы, драцены, суккуленты и кактусы, марантовые,
пальмы, папоротники, орхидеи, цветущие) — у каждого карточка ухода: свет, полив летом и зимой,
влажность, температура, подкормки по месяцам, пересадка, размножение, советы и токсичность для
животных. Латинские названия актуальные, прежние сохранены синонимами — поиск и распознавание
находят «калатею», «сенполию» или «Sansevieria» по старым названиям. Первые 10 видов — в
`supabase/seed.sql`, остальные — миграция `*_knowledge_base_expansion.sql` (повторный запуск безопасен).

## Сбор новостей

Edge Function `supabase/functions/news-ingest` читает RSS/Atom-ленты из таблицы `news_sources`,
сохраняет заголовок, выдержку, картинку и ссылку (без полного текста) и отмечает упомянутые
виды из базы знаний. В проекте `intskfwuljzaaghoaqfx` функция развёрнута и запускается
`pg_cron` каждый час в :17 (задача `news-ingest-hourly`).

Для нового проекта:
1. `supabase functions deploy news-ingest --no-verify-jwt`
2. `select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');`
3. Применить миграции — `*_news_schedule.sql` создаст секрет вызова в Vault и расписание.

Источники добавляются строкой в `news_sources`; неработающая лента пишет ошибку в `last_error`.
Ответы последних запусков: `select * from net._http_response order by created desc limit 5;`

## Распознавание растений по фото

Два бесплатных источника, приложение выбирает сам:

1. **Pl@ntNet** (основной) — Edge Function `identify-plant`, бесплатный тариф (500 запросов в
   день). Ключ хранится в Vault (`plantnet_api_key`) и читается только сервером; квоты —
   20 распознаваний в день на пользователя и 450 на проект. Отдаёт русские названия.
   Проверено на фото монстеры, сансевиерии, замиокулькаса, эпипремнума и спатифиллума —
   верный вид или род первым вариантом.
2. **Модель на телефоне** (запасной, без сети) — Google AIY Vision «plants V1» (TFLite, 2102 вида,
   Apache-2.0), скачивается один раз из бакета `ml-models`. Обучена в основном на дикорастущих
   растениях: из стартовой базы знает монстеру, алоэ и толстянку.

Без интернета, при исчерпанной квоте или сбое сервера используется модель на телефоне.
Результат сопоставляется с базой знаний: точный вид, вид того же рода («уточните») или
название из Pl@ntNet, если вида в базе нет.

Для нового проекта: `select vault.create_secret('<ключ>', 'plantnet_api_key');`, деплой
`supabase functions deploy identify-plant --no-verify-jwt`; модель — функцией `fetch-plant-model`.

## Проверки

```bash
flutter analyze && flutter test                      # приложение
../scripts/check-migrations.sh                       # миграции + дымовой тест на локальном Postgres
node --experimental-strip-types --test ../supabase/functions/news-ingest/feed.test.ts
```
