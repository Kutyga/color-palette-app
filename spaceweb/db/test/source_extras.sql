-- Дополняет локальную имитацию Supabase (supabase/tests/supabase_stub.sql) тем, что читает
-- перенос: колонки auth.users и storage, секреты и задания pg_cron. Только для test-local.sh.

alter table auth.users
  add column encrypted_password text,
  add column email_confirmed_at timestamptz,
  add column raw_app_meta_data  jsonb,
  add column last_sign_in_at    timestamptz,
  add column banned_until       timestamptz,
  add column created_at         timestamptz not null default now(),
  add column updated_at         timestamptz,
  add column deleted_at         timestamptz;

alter table storage.buckets
  add column if not exists file_size_limit    bigint,
  add column if not exists allowed_mime_types text[],
  add column created_at         timestamptz default now();

alter table storage.objects
  add column metadata   jsonb,
  add column created_at timestamptz default now(),
  add column updated_at timestamptz;

create schema cron;
create table cron.job (jobid bigserial primary key, jobname text, schedule text, command text, active boolean default true);
insert into cron.job (jobname, schedule, command) values
  ('contests-finish', '*/5 * * * *', 'select private.finish_due_contests()'),
  ('push-care-reminders', '*/5 * * * *', 'select private.enqueue_care_reminders()');

-- Пароль «test-password» в формате bcrypt, как его хранит Supabase.
update auth.users
   set encrypted_password = extensions.crypt('test-password', extensions.gen_salt('bf', 10)),
       email_confirmed_at = now();

insert into storage.objects (bucket_id, name, owner, metadata)
select 'plant-photos', '00000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000001/cover.jpg',
       '00000000-0000-0000-0000-00000000000a', '{"size": 12345, "mimetype": "image/jpeg"}'
where exists (select 1 from storage.buckets where id = 'plant-photos');
