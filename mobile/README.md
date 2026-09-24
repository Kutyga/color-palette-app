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

## Сбор новостей

Edge Function `supabase/functions/news-ingest` раз в час читает RSS/Atom-ленты из таблицы
`news_sources`, сохраняет заголовок, выдержку, картинку и ссылку (без полного текста) и отмечает
упомянутые виды из базы знаний. Развёртывание и расписание описаны в начале `index.ts`.
Источники добавляются строкой в `news_sources`; неработающая лента пишет ошибку в `last_error`.

## Проверки

```bash
flutter analyze && flutter test                      # приложение
../scripts/check-migrations.sh                       # миграции + дымовой тест на локальном Postgres
node --experimental-strip-types --test ../supabase/functions/news-ingest/feed.test.ts
```
