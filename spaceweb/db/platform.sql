-- Служебные схемы Supabase, на которые опирается схема «Подоконника», для обычного PostgreSQL
-- на хостинге SpaceWeb. Выполняется владельцем базы — без прав суперпользователя и без ролей.
--
-- Что заменяет:
--   auth     — пользователи и вход (auth.users, auth.uid(), auth.role()); вход выполняет PHP;
--   storage  — метаданные файлов и правила доступа к ним; сами файлы лежат на диске хостинга;
--   vault    — секреты (ключи PlantNet, Gemini, секрет cron);
--   cron     — расписание: задания хранятся здесь, выполняет их PHP по cron из панели SpaceWeb;
--   net      — исходящие HTTP-запросы: складываются в очередь, отправляет PHP.
--
-- Кто сделал запрос, база узнаёт из настроек транзакции, которые ставит PHP:
--   request.jwt.claims = {"sub": "<id пользователя>", "role": "authenticated"}.
-- Без них запрос анонимный (роль anon).

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- auth
-- ---------------------------------------------------------------------------

create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  -- bcrypt, как в Supabase: пароли переносятся без смены, PHP проверяет их password_verify.
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb not null default '{}',
  raw_app_meta_data  jsonb not null default '{}',
  last_sign_in_at    timestamptz,
  banned_until       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);
create unique index if not exists users_email_key on auth.users (lower(email)) where deleted_at is null;

-- Долгоживущие токены входа; в базе только хеш.
create table if not exists auth.refresh_tokens (
  token_hash text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists refresh_tokens_user_idx on auth.refresh_tokens (user_id);

create or replace function auth.jwt() returns jsonb
language sql stable
as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;

create or replace function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    auth.jwt() ->> 'sub'
  )::uuid
$$;

-- Роль запроса: anon, authenticated или service_role (служебные вызовы PHP).
create or replace function auth.role() returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    auth.jwt() ->> 'role',
    case when auth.uid() is null then 'anon' else 'authenticated' end
  )
$$;

-- Пропуск мимо RLS — как у postgres в Supabase. Его получают security definer функции на время
-- работы (spaceweb/db/harden.sql) и служебные задания PHP. Своей настройки («app.…») обычному
-- владельцу базы функциям не прописать, поэтому признак — особое значение application_name.
-- Из браузера его не поставить: к базе подключается и пишет SQL только PHP.
create or replace function auth.rls_bypass() returns boolean
language sql stable
as $$ select current_setting('application_name') = 'podokonnik-rls-bypass' $$;

-- ---------------------------------------------------------------------------
-- storage
-- ---------------------------------------------------------------------------

create schema if not exists storage;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text not null references storage.buckets (id),
  name       text not null,
  owner      uuid,
  metadata   jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text) returns text[]
language plpgsql immutable
as $$
declare
  parts text[];
begin
  parts := string_to_array(name, '/');
  return parts[1:array_length(parts, 1) - 1];
end;
$$;

create or replace function storage.filename(name text) returns text
language sql immutable
as $$ select (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)] $$;

create or replace function storage.extension(name text) returns text
language sql immutable
as $$ select lower(substring(storage.filename(name) from '\.([^.]+)$')) $$;

-- ---------------------------------------------------------------------------
-- vault — открыто, как и остальная база: доступ к ней есть только у владельца (PHP).
-- ---------------------------------------------------------------------------

create schema if not exists vault;

create table if not exists vault.secrets (
  id          uuid primary key default gen_random_uuid(),
  name        text unique,
  secret      text not null,
  description text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace view vault.decrypted_secrets as
  select id, name, secret as decrypted_secret, description, created_at, updated_at from vault.secrets;

create or replace function vault.create_secret(new_secret text, new_name text default null, new_description text default '')
returns uuid
language sql
as $$
  insert into vault.secrets (name, secret, description) values (new_name, new_secret, new_description) returning id
$$;

create or replace function vault.update_secret(secret_id uuid, new_secret text default null, new_name text default null,
                                               new_description text default null)
returns void
language sql
as $$
  update vault.secrets
     set secret = coalesce(new_secret, secret), name = coalesce(new_name, name),
         description = coalesce(new_description, description), updated_at = now()
   where id = secret_id
$$;

-- ---------------------------------------------------------------------------
-- cron — те же функции, что у pg_cron; задания выполняет PHP (spaceweb/api/cron.php).
-- ---------------------------------------------------------------------------

create schema if not exists cron;

create table if not exists cron.job (
  jobid        bigserial primary key,
  jobname      text unique,
  schedule     text not null,
  command      text not null,
  active       boolean not null default true,
  last_run_at  timestamptz,
  last_status  text,
  last_message text
);

create or replace function cron.schedule(job_name text, schedule text, command text) returns bigint
language sql
as $$
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command, active = true
  returning jobid
$$;

create or replace function cron.schedule(schedule text, command text) returns bigint
language sql
as $$ insert into cron.job (schedule, command) values (schedule, command) returning jobid $$;

create or replace function cron.unschedule(job_name text) returns boolean
language sql
as $$ with d as (delete from cron.job where jobname = job_name returning 1) select exists (select 1 from d) $$;

create or replace function cron.unschedule(job_id bigint) returns boolean
language sql
as $$ with d as (delete from cron.job where jobid = job_id returning 1) select exists (select 1 from d) $$;

-- ---------------------------------------------------------------------------
-- net — как pg_net: запрос ставится в очередь и уходит сразу после транзакции (PHP).
-- ---------------------------------------------------------------------------

create schema if not exists net;

create table if not exists net.http_request_queue (
  id                   bigserial primary key,
  method               text not null,
  url                  text not null,
  headers              jsonb not null default '{}',
  body                 jsonb,
  timeout_milliseconds int not null default 5000,
  created_at           timestamptz not null default now(),
  sent_at              timestamptz,
  status_code          int,
  error                text
);

create or replace function net.http_post(
  url text,
  body jsonb default '{}',
  params jsonb default '{}',
  headers jsonb default '{"Content-Type": "application/json"}',
  timeout_milliseconds int default 5000
) returns bigint
language sql
as $$
  insert into net.http_request_queue (method, url, headers, body, timeout_milliseconds)
  values ('POST', url, headers, body, timeout_milliseconds)
  returning id
$$;
