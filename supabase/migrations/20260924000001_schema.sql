-- Схема приложения «Мой сад»: коллекция, уход, база знаний, социальная часть.
-- Первичные ключи генерирует клиент (офлайн-создание + идемпотентная синхронизация),
-- default gen_random_uuid() — для записей, созданных на сервере.

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Общие функции
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Профили
-- ---------------------------------------------------------------------------

create table public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  username           text unique not null check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name       text,
  avatar_url         text,
  bio                text check (char_length(bio) <= 500),
  city               text,                        -- только город, без координат
  climate_zone       text,
  hemisphere         char(1) not null default 'N' check (hemisphere in ('N', 'S')),
  default_visibility text not null default 'followers'
                     check (default_visibility in ('private', 'followers', 'public')),
  reminder_time      time not null default '09:00',
  timezone           text not null default 'UTC',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Профиль создаётся автоматически при регистрации.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_name text;
begin
  base_name := lower(regexp_replace(
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1), 'user'),
    '[^a-zA-Z0-9_]', '', 'g'));
  if char_length(base_name) < 3 then
    base_name := 'user';
  end if;
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    left(base_name, 21) || '_' || substr(replace(new.id::text, '-', ''), 1, 8),
    new.raw_user_meta_data ->> 'display_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- База знаний
-- ---------------------------------------------------------------------------

create table public.families (
  id         uuid primary key default gen_random_uuid(),
  latin_name text unique not null,
  name_ru    text
);

create table public.genera (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid references public.families(id),
  latin_name text unique not null,
  name_ru    text
);

create table public.species (
  id              uuid primary key default gen_random_uuid(),
  genus_id        uuid references public.genera(id),
  slug            text unique not null,
  latin_name      text unique not null,
  common_names    jsonb not null default '{}',   -- {"ru": ["Фикус каучуконосный"], "en": [...]}
  synonyms        text[] not null default '{}',
  description     jsonb not null default '{}',   -- {"ru": "...", "en": "..."}
  origin          text,
  plant_type      text,
  difficulty      smallint check (difficulty between 1 and 5),
  toxic_to_pets   boolean,
  toxic_to_humans boolean,
  air_purifying   boolean,
  max_height_cm   int,
  image_url       text,
  gbif_id         bigint,
  search_text     text not null default '',      -- заполняется триггером
  search_tsv      tsvector,
  kb_version      int not null default 1,
  updated_at      timestamptz not null default now()
);

create index species_search_tsv_idx on public.species using gin (search_tsv);
create index species_search_trgm_idx on public.species using gin (search_text gin_trgm_ops);

create or replace function public.species_search_refresh()
returns trigger
language plpgsql
as $$
declare
  names text;
begin
  select coalesce(string_agg(value, ' '), '')
    into names
    from jsonb_each(new.common_names) as lang(key, arr),
         jsonb_array_elements_text(arr) as value;
  new.search_text := lower(new.latin_name || ' ' || names || ' '
                           || array_to_string(new.synonyms, ' '));
  new.search_tsv := to_tsvector('simple', new.search_text);
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.kb_version := old.kb_version + 1;
  end if;
  return new;
end;
$$;

create trigger species_search_refresh before insert or update on public.species
  for each row execute function public.species_search_refresh();

create table public.care_profiles (
  species_id                   uuid primary key references public.species(id) on delete cascade,
  light                        text check (light in ('low', 'medium', 'bright_indirect', 'direct')),
  water_interval_summer        numeric(4,1) not null check (water_interval_summer > 0),
  water_interval_winter        numeric(4,1) not null check (water_interval_winter > 0),
  soil_dryness_before_watering jsonb,
  humidity_min_pct             smallint,
  temp_min_c                   smallint,
  temp_max_c                   smallint,
  fertilize_interval_days      smallint,
  fertilize_months             smallint[],
  repot_every_years            smallint,
  soil_mix                     jsonb,
  propagation                  text[],
  dormancy_months              smallint[],
  tips                         jsonb not null default '{}'
);

create table public.diseases (
  id        uuid primary key default gen_random_uuid(),
  kind      text not null check (kind in ('pest', 'fungus', 'bacteria', 'virus', 'care_issue')),
  name      jsonb not null,
  symptoms  jsonb not null default '{}',
  treatment jsonb not null default '{}',
  photos    text[] not null default '{}'
);

create table public.species_diseases (
  species_id uuid references public.species(id) on delete cascade,
  disease_id uuid references public.diseases(id) on delete cascade,
  primary key (species_id, disease_id)
);

create table public.kb_articles (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        jsonb not null,
  body_md      jsonb not null,
  tags         text[] not null default '{}',
  published_at timestamptz
);

create table public.kb_article_species (
  article_id uuid references public.kb_articles(id) on delete cascade,
  species_id uuid references public.species(id) on delete cascade,
  primary key (article_id, species_id)
);

-- ---------------------------------------------------------------------------
-- Коллекция
-- ---------------------------------------------------------------------------

create table public.locations (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name        text not null,
  light_level text check (light_level in ('low', 'medium', 'bright_indirect', 'direct')),
  is_outdoor  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index locations_owner_idx on public.locations (owner_id, updated_at);
create trigger locations_updated_at before update on public.locations
  for each row execute function public.set_updated_at();

create table public.plants (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  species_id      uuid references public.species(id),
  location_id     uuid references public.locations(id),
  nickname        text not null check (char_length(nickname) between 1 and 60),
  acquired_at     date,
  pot_material    text check (pot_material in ('plastic', 'ceramic', 'terracotta', 'glass', 'other')),
  pot_diameter_cm smallint check (pot_diameter_cm > 0),
  cover_photo_id  uuid,
  notes           text,
  visibility      text not null default 'followers'
                  check (visibility in ('private', 'followers', 'public')),
  status          text not null default 'alive'
                  check (status in ('alive', 'dormant', 'gifted', 'dead')),
  parent_plant_id uuid references public.plants(id),   -- «родословная» черенков
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index plants_owner_idx on public.plants (owner_id, updated_at);
create index plants_species_idx on public.plants (species_id);
create trigger plants_updated_at before update on public.plants
  for each row execute function public.set_updated_at();

create table public.plant_photos (
  id           uuid primary key default gen_random_uuid(),
  plant_id     uuid not null references public.plants(id) on delete cascade,
  uploaded_by  uuid not null default auth.uid() references public.profiles(id),
  storage_path text not null,
  taken_at     timestamptz not null default now(),
  caption      text,
  created_at   timestamptz not null default now()
);

create index plant_photos_plant_idx on public.plant_photos (plant_id, taken_at desc);

alter table public.plants
  add constraint plants_cover_photo_fk foreign key (cover_photo_id)
  references public.plant_photos(id) on delete set null;

-- Совместный уход: семья, соседи, «присмотри, пока я в отпуске».
create table public.plant_caretakers (
  plant_id   uuid references public.plants(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete cascade,
  until      timestamptz,                      -- null = бессрочно
  created_at timestamptz not null default now(),
  primary key (plant_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Уход
-- ---------------------------------------------------------------------------

create type public.care_type as enum
  ('water', 'fertilize', 'mist', 'repot', 'prune', 'rotate', 'clean_leaves', 'treat_pests');

create table public.care_schedules (
  id            uuid primary key default gen_random_uuid(),
  plant_id      uuid not null references public.plants(id) on delete cascade,
  type          public.care_type not null,
  interval_days numeric(5,1) not null check (interval_days > 0),
  auto_adjust   boolean not null default true,
  user_factor   numeric(4,2) not null default 1.0 check (user_factor between 0.3 and 3.0),
  last_done_at  timestamptz,
  next_due_at   timestamptz,
  enabled       boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (plant_id, type)
);

create index care_schedules_due_idx on public.care_schedules (next_due_at) where enabled;
create trigger care_schedules_updated_at before update on public.care_schedules
  for each row execute function public.set_updated_at();

-- Журнал ухода: только добавление, поэтому при синхронизации не бывает конфликтов.
create table public.care_events (
  id           uuid primary key default gen_random_uuid(),
  plant_id     uuid not null references public.plants(id) on delete cascade,
  performed_by uuid not null default auth.uid() references public.profiles(id),
  type         public.care_type not null,
  performed_at timestamptz not null default now(),
  amount_ml    int check (amount_ml > 0),
  note         text,
  photo_id     uuid references public.plant_photos(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index care_events_plant_idx on public.care_events (plant_id, type, performed_at desc);

-- ---------------------------------------------------------------------------
-- Социальная часть
-- ---------------------------------------------------------------------------

create table public.follows (
  follower_id uuid references public.profiles(id) on delete cascade,
  followee_id uuid references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index follows_followee_idx on public.follows (followee_id);

create table public.blocks (
  blocker_id uuid references public.profiles(id) on delete cascade,
  blocked_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  plant_id      uuid references public.plants(id) on delete set null,
  kind          text not null default 'photo'
                check (kind in ('photo', 'milestone', 'question', 'swap_offer')),
  text          text check (char_length(text) <= 2000),
  photo_paths   text[] not null default '{}',
  visibility    text not null default 'public'
                check (visibility in ('followers', 'public')),
  like_count    int not null default 0,
  comment_count int not null default 0,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index posts_author_idx on public.posts (author_id, created_at desc);
create index posts_feed_idx on public.posts (created_at desc, id desc) where deleted_at is null;

create table public.likes (
  user_id    uuid references public.profiles(id) on delete cascade,
  post_id    uuid references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  author_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  parent_id  uuid references public.comments(id) on delete cascade,
  text       text not null check (char_length(text) between 1 and 1000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index comments_post_idx on public.comments (post_id, created_at);

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('profile', 'plant', 'post', 'comment')),
  target_id   uuid not null,
  reason      text not null,
  status      text not null default 'open' check (status in ('open', 'resolved', 'rejected')),
  created_at  timestamptz not null default now()
);

create table public.wishlist_items (
  user_id    uuid default auth.uid() references public.profiles(id) on delete cascade,
  species_id uuid references public.species(id) on delete cascade,
  note       text,
  created_at timestamptz not null default now(),
  primary key (user_id, species_id)
);

create table public.devices (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  platform     text not null check (platform in ('ios', 'android')),
  push_token   text unique not null,
  locale       text,
  timezone     text,
  last_seen_at timestamptz not null default now()
);
