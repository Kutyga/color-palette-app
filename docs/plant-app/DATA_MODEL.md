# Модель данных

Postgres (Supabase). Все первичные ключи — UUID, генерируемые клиентом (для офлайн-создания и
идемпотентной синхронизации). Все пользовательские таблицы имеют `created_at`, `updated_at`,
`deleted_at` (мягкое удаление).

## ER-схема (упрощённо)

```
profiles 1──* locations 1──* plants *──1 species *──1 genera *──1 families
    │                          │  │           │
    │                          │  └──* plant_photos
    │                          ├──* care_schedules
    │                          └──* care_events
    │                                          species 1──1 care_profiles
    ├──* follows (follower → followee)         species *──* diseases (через species_diseases)
    ├──* posts 1──* comments                   kb_articles *──* species
    │        └──* likes
    ├──* devices (push-токены)
    └──* wishlist_items *──1 species
```

## Пользователи и коллекция

```sql
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique not null check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name  text,
  avatar_url    text,
  bio           text,
  city          text,                       -- только город, без координат
  climate_zone  text,                       -- USDA/Köppen, для рекомендаций
  hemisphere    char(1) default 'N',        -- для сезонных коэффициентов
  default_visibility text not null default 'followers'
                check (default_visibility in ('private','followers','public')),
  reminder_time time default '09:00',
  quiet_hours   int4range,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table locations (                    -- «Гостиная, южное окно», «Балкон»
  id           uuid primary key,
  owner_id     uuid not null references profiles(id),
  name         text not null,
  light_level  text check (light_level in ('low','medium','bright_indirect','direct')),
  is_outdoor   boolean default false,
  updated_at   timestamptz default now(),
  deleted_at   timestamptz
);

create table plants (
  id              uuid primary key,
  owner_id        uuid not null references profiles(id),
  species_id      uuid references species(id),      -- null, если вид неизвестен
  location_id     uuid references locations(id),
  nickname        text not null,                    -- «Фикус Боря»
  acquired_at     date,
  pot_material    text check (pot_material in ('plastic','ceramic','terracotta','glass','other')),
  pot_diameter_cm smallint,
  cover_photo_id  uuid,
  notes           text,
  visibility      text not null default 'followers',
  status          text not null default 'alive'
                  check (status in ('alive','dormant','gifted','dead')),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  deleted_at      timestamptz
);
create index on plants (owner_id) where deleted_at is null;

create table plant_photos (
  id          uuid primary key,
  plant_id    uuid not null references plants(id),
  storage_path text not null,
  taken_at    timestamptz not null,
  caption     text,
  created_at  timestamptz default now()
);

-- Совместный уход (семья, соседи по квартире)
create table plant_caretakers (
  plant_id  uuid references plants(id),
  user_id   uuid references profiles(id),
  role      text check (role in ('owner','caretaker')),
  primary key (plant_id, user_id)
);
```

## Уход

```sql
create type care_type as enum
  ('water','fertilize','mist','repot','prune','rotate','clean_leaves','treat_pests');

create table care_schedules (
  id                uuid primary key,
  plant_id          uuid not null references plants(id),
  type              care_type not null,
  interval_days     numeric(5,1) not null,      -- базовый интервал
  auto_adjust       boolean default true,       -- учитывать сезон/погоду/поведение
  user_factor       numeric(4,2) default 1.0,   -- обучаемый коэффициент
  next_due_at       timestamptz,                -- денормализация для запросов «что сегодня»
  enabled           boolean default true,
  updated_at        timestamptz default now(),
  unique (plant_id, type)
);
create index on care_schedules (next_due_at) where enabled;

create table care_events (                      -- append-only журнал
  id           uuid primary key,
  plant_id     uuid not null references plants(id),
  performed_by uuid not null references profiles(id),
  type         care_type not null,
  performed_at timestamptz not null,
  amount_ml    int,
  note         text,
  photo_id     uuid references plant_photos(id),
  created_at   timestamptz default now()
);
create index on care_events (plant_id, type, performed_at desc);
```

## База знаний

```sql
create table families (id uuid primary key, latin_name text unique, name_ru text);
create table genera   (id uuid primary key, family_id uuid references families(id),
                       latin_name text unique, name_ru text);

create table species (
  id            uuid primary key,
  genus_id      uuid references genera(id),
  latin_name    text unique not null,          -- Ficus elastica
  common_names  jsonb not null default '{}',   -- {"ru": ["Фикус каучуконосный"], "en": [...]}
  synonyms      text[] default '{}',
  description   jsonb,                         -- локализованный текст
  origin        text,
  plant_type    text,                          -- суккулент, лиана, дерево, ...
  difficulty    smallint check (difficulty between 1 and 5),
  toxic_to_pets boolean,
  toxic_to_humans boolean,
  air_purifying boolean,
  max_height_cm int,
  gbif_id       bigint,                        -- внешний идентификатор
  search_tsv    tsvector,
  kb_version    int not null default 1,
  updated_at    timestamptz default now()
);
create index on species using gin (search_tsv);
create index on species using gin (latin_name gin_trgm_ops);

create table care_profiles (                   -- структурированные рекомендации
  species_id              uuid primary key references species(id),
  light                   text,                -- low / medium / bright_indirect / direct
  water_interval_summer   numeric(4,1),        -- дней
  water_interval_winter   numeric(4,1),
  soil_dryness_before_watering text,           -- «верхние 2–3 см», «полностью»
  humidity_min_pct        smallint,
  temp_min_c              smallint,
  temp_max_c              smallint,
  fertilize_interval_days smallint,
  fertilize_months        smallint[],          -- [3..9]
  repot_every_years       smallint,
  soil_mix                text,
  propagation             text[],              -- черенки, деление, семена
  dormancy_months         smallint[],
  tips                    jsonb                -- локализованные советы
);

create table diseases (                        -- болезни, вредители, проблемы
  id        uuid primary key,
  kind      text check (kind in ('pest','fungus','bacteria','care_issue')),
  name      jsonb,
  symptoms  jsonb,                             -- для мастера диагностики
  treatment jsonb,
  photos    text[]
);
create table species_diseases (species_id uuid, disease_id uuid, primary key (species_id, disease_id));

create table kb_articles (
  id        uuid primary key,
  slug      text unique,
  title     jsonb,
  body_md   jsonb,
  tags      text[],
  published_at timestamptz
);
create table kb_article_species (article_id uuid, species_id uuid, primary key (article_id, species_id));
```

## Социальная часть

```sql
create table follows (
  follower_id uuid references profiles(id),
  followee_id uuid references profiles(id),
  created_at  timestamptz default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create table posts (
  id         uuid primary key,
  author_id  uuid not null references profiles(id),
  plant_id   uuid references plants(id),       -- пост о конкретном растении
  kind       text check (kind in ('photo','milestone','question','swap_offer')),
  text       text,
  photo_ids  uuid[],
  visibility text not null default 'public',
  like_count int default 0,                     -- денормализация, обновляется триггером
  comment_count int default 0,
  created_at timestamptz default now(),
  deleted_at timestamptz
);
create index on posts (author_id, created_at desc);

create table likes    (user_id uuid, post_id uuid, created_at timestamptz default now(),
                       primary key (user_id, post_id));
create table comments (id uuid primary key, post_id uuid references posts(id),
                       author_id uuid references profiles(id), text text not null,
                       parent_id uuid references comments(id), created_at timestamptz default now(),
                       deleted_at timestamptz);

create table reports  (id uuid primary key, reporter_id uuid, target_type text, target_id uuid,
                       reason text, status text default 'open', created_at timestamptz default now());
create table blocks   (blocker_id uuid, blocked_id uuid, primary key (blocker_id, blocked_id));

create table wishlist_items (user_id uuid, species_id uuid, note text,
                             primary key (user_id, species_id));

create table devices (
  id          uuid primary key,
  user_id     uuid references profiles(id),
  platform    text check (platform in ('ios','android')),
  push_token  text unique,
  locale      text,
  timezone    text,
  last_seen_at timestamptz
);
```

## Пример политики RLS

```sql
alter table plants enable row level security;

create policy plants_owner_rw on plants
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy plants_read_shared on plants
  for select using (
    deleted_at is null and (
      visibility = 'public'
      or (visibility = 'followers' and exists (
            select 1 from follows f
            where f.follower_id = auth.uid() and f.followee_id = plants.owner_id))
      or exists (select 1 from plant_caretakers c
                 where c.plant_id = plants.id and c.user_id = auth.uid())
    )
    and not exists (select 1 from blocks b
                    where b.blocker_id = plants.owner_id and b.blocked_id = auth.uid())
  );
```

## Локальная БД клиента (Drift)

Зеркалирует собственные таблицы (`locations`, `plants`, `plant_photos`, `care_schedules`,
`care_events`) плюс:

- `kb_species_cache`, `kb_care_profiles_cache` — кэш базы знаний;
- `outbox (id, entity, entity_id, op, payload_json, created_at, attempts)` — очередь на отправку;
- `sync_state (entity, last_pulled_at)`;
- `pending_uploads (photo_id, local_path, status)` — фото, ожидающие загрузки.
