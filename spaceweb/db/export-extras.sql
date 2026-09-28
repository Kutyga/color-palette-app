-- Выполняется на исходной базе (Supabase): печатает SQL, который воссоздаёт на SpaceWeb то,
-- чего нет в дампе схем public и private. Запуск: psql -XAt -f export-extras.sql.
--   1. пользователей (с bcrypt-хешами паролей) и метаданные файлов;
--   2. секреты Vault и задания pg_cron;
--   3. наши триггеры на auth.users (правила RLS — в export-policies.sql);
--   4. права ролей anon и authenticated — по ним PHP решает, какие таблицы, колонки
--      и функции доступны из браузера (ролей на SpaceWeb нет).

\set QUIET on
\pset tuples_only on
\pset format unaligned

select '-- Сгенерировано export-extras.sql ' || now()::text;
select 'set check_function_bodies = off;';

-- 1. Пользователи и файлы ------------------------------------------------------

select format(
  'insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, '
  'last_sign_in_at, banned_until, created_at, updated_at, deleted_at) values (%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L);',
  id, email, encrypted_password, email_confirmed_at, coalesce(raw_user_meta_data, '{}'), coalesce(raw_app_meta_data, '{}'),
  last_sign_in_at, banned_until, coalesce(created_at, now()), coalesce(updated_at, created_at, now()), deleted_at)
from auth.users
order by created_at;

select format(
  'insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types, created_at) values (%L, %L, %L, %L, %L, %L);',
  id, name, coalesce(public, false), file_size_limit, allowed_mime_types, coalesce(created_at, now()))
from storage.buckets
order by id;

select format(
  'insert into storage.objects (id, bucket_id, name, owner, metadata, created_at, updated_at) values (%L, %L, %L, %L, %L, %L, %L);',
  id, bucket_id, name, owner, coalesce(metadata, '{}'), coalesce(created_at, now()), coalesce(updated_at, created_at, now()))
from storage.objects
order by bucket_id, name;

-- 2. Секреты и расписание --------------------------------------------------------

select format('insert into vault.secrets (name, secret, description) values (%L, %L, %L);',
              name, decrypted_secret, coalesce(description, ''))
from vault.decrypted_secrets
where name is not null
order by name;

select format('insert into cron.job (jobname, schedule, command, active) values (%L, %L, %L, %L);',
              jobname, schedule, command, active)
from cron.job
order by jobid;

-- 3. Наши триггеры на auth.users ---------------------------------------------------

select pg_get_triggerdef(t.oid) || ';'
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
join pg_namespace n on n.oid = p.pronamespace
where t.tgrelid = 'auth.users'::regclass
  and not t.tgisinternal
  and n.nspname in ('public', 'private')
order by t.tgname;

-- 4. Права ролей API на объекты схемы public ---------------------------------------

select 'create schema if not exists api;';
select 'create table if not exists api.table_privileges (role text, relation text, privilege text, primary key (role, relation, privilege));';
select 'create table if not exists api.column_privileges (role text, relation text, column_name text, privilege text, '
       'primary key (role, relation, column_name, privilege));';
select 'create table if not exists api.routine_privileges (role text, routine text, primary key (role, routine));';
select 'truncate api.table_privileges, api.column_privileges, api.routine_privileges;';

select format('insert into api.table_privileges values (%L, %L, %L);', r.role, c.relname, p.priv)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join (values ('anon'), ('authenticated')) r(role)
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) p(priv)
where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')
  and has_table_privilege(r.role, c.oid, p.priv)
order by 1;

-- Колоночные права — только там, где нет права на всю таблицу (например, UPDATE только части колонок).
select format('insert into api.column_privileges values (%L, %L, %L, %L);', r.role, c.relname, a.attname, p.priv)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
cross join (values ('anon'), ('authenticated')) r(role)
cross join (values ('SELECT'), ('INSERT'), ('UPDATE')) p(priv)
where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')
  and not has_table_privilege(r.role, c.oid, p.priv)
  and has_column_privilege(r.role, c.oid, a.attnum, p.priv)
order by 1;

select format('insert into api.routine_privileges values (%L, %L);', r.role, p.proname)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join (values ('anon'), ('authenticated')) r(role)
where n.nspname = 'public' and p.prokind = 'f'
  and has_function_privilege(r.role, p.oid, 'EXECUTE')
group by r.role, p.proname
order by 1;
