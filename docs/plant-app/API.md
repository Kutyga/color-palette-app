# API

Основной доступ к данным — через PostgREST (Supabase SDK) с RLS. Нетривиальная логика — через
Edge Functions (`POST /functions/v1/<name>`). Все запросы — с JWT пользователя.

## CRUD через PostgREST (примеры)

| Действие | Запрос |
|---|---|
| Мои растения | `GET /rest/v1/plants?owner_id=eq.{me}&deleted_at=is.null&select=*,species(latin_name,common_names),care_schedules(*)` |
| Что полить сегодня | `GET /rest/v1/care_schedules?next_due_at=lte.{end_of_day}&enabled=is.true&select=*,plants!inner(nickname,cover_photo_id,owner_id)` |
| Отметить полив | `POST /rest/v1/care_events` `{id, plant_id, type:"water", performed_at}` → триггер пересчитывает `next_due_at` |
| Коллекция другого пользователя | `GET /rest/v1/plants?owner_id=eq.{userId}` (RLS отфильтрует по видимости) |
| Поиск по базе знаний | `POST /rest/v1/rpc/search_species` `{query:"фикус", limit:20}` |
| Подписаться | `POST /rest/v1/follows` `{follower_id: me, followee_id}` |
| Синхронизация (pull) | `GET /rest/v1/{table}?owner_id=eq.{me}&updated_at=gt.{last_pulled_at}` |

## Edge Functions

### `POST /identify-plant`
Распознавание по фото.

```json
// запрос
{ "image_path": "plant-photos/…/abc.jpg", "organ": "leaf" }
// ответ
{
  "suggestions": [
    { "species_id": "…", "latin_name": "Monstera deliciosa", "name": "Монстера деликатесная",
      "probability": 0.94, "care_summary": { "light": "bright_indirect", "water_interval_days": 7 } }
  ],
  "health": { "is_healthy": false, "issues": [ { "disease_id": "…", "probability": 0.61 } ] },
  "remaining_quota": 9
}
```
Лимит: 10 распознаваний в день на бесплатном тарифе.

### `POST /feed`
```json
// запрос
{ "tab": "following" | "discover", "cursor": "2026-09-20T10:00:00Z|<uuid>", "limit": 20 }
// ответ
{ "items": [ { "type": "post", "post": { … }, "author": { … } } ], "next_cursor": "…" }
```

### `POST /care-recommendations`
Персональные рекомендации для растения с учётом вида, сезона, погоды в городе и истории ухода.
```json
{ "plant_id": "…" }
→ { "water_interval_days": 9.5, "reasons": ["Зима: интервал увеличен на 40%", "Терракотовый горшок: −10%"],
    "tips": ["Протирайте листья раз в 2 недели"], "warnings": ["Токсичен для кошек"] }
```

### `POST /sync/push`
Батч-отправка outbox, если нужна транзакционность нескольких таблиц.
```json
{ "ops": [ { "entity": "plants", "op": "upsert", "data": { … } },
           { "entity": "care_events", "op": "insert", "data": { … } } ] }
→ { "applied": ["…uuid"], "conflicts": [ { "id": "…", "server": { … } } ] }
```

### `POST /devices/register`
`{ "platform": "ios", "push_token": "…", "timezone": "Europe/Moscow", "locale": "ru" }`

### Cron-функции (без публичного доступа)

| Функция | Расписание | Что делает |
|---|---|---|
| `care-scheduler` | каждый час | Находит просроченный уход, шлёт резервные push, учитывает часовой пояс и тихие часы |
| `weather-adjust` | раз в сутки | Тянет прогноз по городам пользователей (Open-Meteo), корректирует `next_due_at` уличных растений (дождь → полив переносится) и шлёт предупреждения о заморозках/жаре |
| `trending` | каждые 30 мин | Пересчитывает популярные посты для вкладки «Интересное» |

## Realtime

- Канал `plant:{id}` — события ухода от со-опекунов (кто-то уже полил → снимаем напоминание).
- Канал `user:{id}:notifications` — лайки, комментарии, новые подписчики.

## Push-уведомления (payload)

```json
{ "type": "care_due", "plant_ids": ["…"], "care_type": "water",
  "title": "Пора полить 3 растения", "deeplink": "myapp://care/today" }
```
Типы: `care_due`, `care_overdue`, `weather_alert`, `new_follower`, `like`, `comment`, `caretaker_done`.

## Deep links

- `myapp://plant/{id}`, `myapp://user/{username}`, `myapp://species/{slug}`, `myapp://care/today`
- Universal Links / App Links на `https://<domain>/u/{username}` — публичная веб-страница коллекции
  для шаринга (SSR-страница, подключает мобильное приложение при наличии).
