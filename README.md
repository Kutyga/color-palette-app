# Подоконник

Сайт для тех, кто держит комнатные растения: коллекция с графиком ухода, база знаний по 244
видам, дневники и взаимопомощь садоводов, барахолка, магазины с «Где купить», распознавание
растений и болезней по фото, достижения и Web Push-напоминания.

**Сайт:** https://kutyga.github.io/color-palette-app/ — можно попробовать в демо-режиме, без регистрации.

## Репозиторий

| Папка | Что внутри |
|---|---|
| [`web/`](web/README.md) | Сайт: Next.js (статический экспорт), TypeScript, Tailwind CSS, TanStack Query |
| `supabase/migrations/` | Схема базы, RLS-политики, триггеры и RPC — по миграции на изменение |
| `supabase/functions/` | Edge Functions (Deno): распознавание, новости, режим чтения, Web Push |
| `supabase/tests/` | Проверка миграций на чистом Postgres |
| `scripts/` | Проверка и применение миграций |
| [`docs/plant-app/`](docs/plant-app/ARCHITECTURE.md) | Архитектура, модель данных, API, функциональность, дизайн |

## Быстрый старт

```bash
cd web
npm install
npm run dev        # http://localhost:3000, без настроек — демо-режим
```

Подключение к Supabase, публикация и устройство кода описаны в [web/README.md](web/README.md),
архитектура — в [docs/plant-app/ARCHITECTURE.md](docs/plant-app/ARCHITECTURE.md).

## Проверки

Workflow `.github/workflows/plant-app.yml` на каждый PR запускает форматирование, линтер,
поиск мёртвого кода, проверку типов, unit- и e2e-тесты сайта, прогон миграций на чистом
Postgres и тесты Edge Functions. Локально те же проверки сайта:

```bash
cd web
npm run format:check && npm run lint && npm run knip && npm run typecheck && npm test
npm run build && npm run e2e
bash ../scripts/check-migrations.sh   # поднимает временный Postgres 15+ (initdb, pg_ctl)
```
