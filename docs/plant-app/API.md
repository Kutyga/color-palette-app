# API

Сайт работает с Supabase напрямую. Таблицы читаются и меняются через PostgREST, права
проверяют RLS-политики. Логика, которую нельзя доверить браузеру, выполняется в RPC
(функции Postgres) и в Edge Functions (`POST /functions/v1/<name>`). Все запросы идут
с JWT вошедшего пользователя.

В коде каждому разделу соответствует свой репозиторий в `web/src/lib/data/supabase/`.
Ниже — что они вызывают.

## Таблицы (PostgREST)

| Раздел | Таблицы | Особенности |
|---|---|---|
| Коллекция и уход | `plants`, `locations`, `care_schedules`, `care_events`, `plant_photos` | Отметка ухода — вставка в `care_events` с id от клиента, поэтому повтор не создаёт дубль. Триггер сдвигает `next_due_at`, удаление отметки откатывает график |
| База знаний | `species` | Нужна только для перевода slug ↔ uuid (`SpeciesIds`); сами карточки — из снимка при сборке |
| Сообщество | `posts`, `comments`, `likes`, `follows`, `blocks`, `reports` | Правка своей записи — в течение часа; окно проверяет база |
| Люди | `profiles`, `profile_cards` | `profile_cards` — представление с публичными полями и счётчиками |
| Барахолка и чат | `listings`, `messages`, `contests` | Новые сообщения приходят через Realtime-канал `chat:<id>` |
| Магазины | `shops`, `shop_products`, `wishlist_items` | Статус магазина меняет только администратор (RPC `review_shop`) |
| Уведомления | `push_subscriptions` | Запись — через RPC `save_push_subscription` |

## RPC

| Функция | Для чего |
|---|---|
| `care_due(p_until)` | Задачи ухода до даты — экран «Сегодня» |
| `my_garden_stats()` | Статистика сада и сообщества — уровни и достижения |
| `feed_diaries(scope, lim)` | Записи дневников: подписки или все публичные |
| `help_questions(filter, lim)` | Вопросы «Помощи»: ждут ответа, про мои виды, мои, все |
| `news_feed(lim, only_my_species, langs)` | Лента новостей с фильтром по языкам и своим видам |
| `search_people(q, lim)`, `people_followers(p_user)`, `people_following(p_user)` | Поиск садоводов и списки подписок |
| `start_conversation(p_listing)`, `my_conversations()`, `mark_conversation_read(p_conversation)` | Переписка по объявлению; лимит новых чатов проверяет функция |
| `shop_import_products(p_rows, p_replace)` | Загрузка каталога: обновление по артикулу, при `p_replace` — удаление отсутствующих |
| `where_to_buy(p_species, p_city)` | «Где купить»: свой город первым, чужие — только с доставкой |
| `review_shop(p_shop, p_status, p_note)` | Решение администратора по заявке магазина |
| `save_push_subscription(p_endpoint, p_p256dh, p_auth, p_user_agent)` | Подписка браузера на Web Push |
| `join_contest(p_contest)`, `leave_contest(p_contest)` | Участие в розыгрыше; условия (возраст аккаунта, растение со своим фото, город) проверяет функция |
| `cancel_contest(p_contest)` | Отмена: организатор — пока нет участников, администратор — всегда |
| `contest_participants(p_contest)` | Участники и места победителей — список открыт всем |

## Хранилище

Бакеты `plant-photos`, `post-photos`, `listing-photos` закрыты. Путь файла начинается с id
владельца, а читать можно по подписанной ссылке, которую выдаёт `signedUrls`
(`supabase/shared.ts`). Право на чтение повторяет видимость растения, записи или объявления.

## Edge Functions

### `identify-plant`

Распознавание вида и болезней по фото. Нужен токен пользователя. Квоты: 20 в день на
пользователя и 450 на проект.

```jsonc
// запрос
{ "image_base64": "…", "organ": "auto", "mode": "species" | "diseases", "plant_hint": "Монстера Мося, Монстера деликатесная" }

// ответ, mode = "species"
{ "source": "plantnet", "results": [{ "name": "Monstera deliciosa", "score": 0.94, "common_names": ["…"], "genus": "Monstera", "family": "Araceae" }] }

// ответ, mode = "diseases": коды EPPO от Pl@ntNet и разбор Gemini (null, если Gemini не ответил)
{
  "source": "plantnet",
  "diseases": [{ "eppo": "TETRUR", "score": 0.41, "name": "Tetranychus urticae" }],
  "ai": {
    "isPlant": true, "healthy": false, "plant": "Монстера", "summary": "…",
    "problems": [{ "cause": "spider_mite", "title": "Паутинный клещ", "confidence": 0.7, "evidence": "…" }]
  }
}
```

`cause` — id причины из справочника `web/src/lib/domain/diagnosis.ts` или `"other"`.

### `news-reader`

`{ "id": "<uuid статьи>" }` → `{ url, title, byline, siteName, lang, excerpt, blocks }`.
Функция скачивает страницу источника и возвращает только текст и картинки («режим чтения»).
Ошибки: `not_found`, `source_unavailable`, `not_html`, `too_large`, `no_article`.

### `push`

- `{ "action": "config" }` → `{ publicKey }`: открытый VAPID-ключ для подписки браузера.
- `{ "action": "send" }` + заголовок `x-cron-secret`: рассылка очереди `private.push_queue`.
  Её вызывает только pg_cron.

### `news-ingest`

Вызывается только из pg_cron (`x-cron-secret`). Собирает RSS/Atom из `news_sources` и
сохраняет статьи через RPC `ingest_news`.

## Push-уведомления

Типы уведомлений: напоминание об уходе (раз в день в выбранное время по часовому поясу
пользователя), новое сообщение, ответ на вопрос, комментарий, «ваш ответ — лучший»,
товар из списка «Хочу» появился в продаже или подешевел. Уведомление ведёт на нужную
страницу сайта.
