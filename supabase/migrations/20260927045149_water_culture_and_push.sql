-- 1) Растение «в воде» (черенок в стакане, гидропоника): полив не нужен.
-- 2) Push-уведомления в браузер (Web Push): подписки, настройки, очередь, напоминания об уходе.
--    База кладёт уведомления в очередь private.push_queue, Edge Function push раз в минуту
--    (pg_cron → pg_net, как news-ingest) отправляет их. VAPID-ключи генерирует сама функция
--    и хранит в Vault — закрытый ключ никогда не покидает сервер.

-- ---------------------------------------------------------------------------
-- Растение в воде
-- ---------------------------------------------------------------------------

alter table public.plants add column in_water boolean not null default false;

-- Переключатель выключает (и включает обратно) график полива этого растения.
create or replace function private.plants_in_water_schedules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.care_schedules
     set enabled = not new.in_water
   where plant_id = new.id and type = 'water';
  return new;
end;
$$;

create trigger plants_in_water_schedules
  after update of in_water on public.plants
  for each row when (old.in_water is distinct from new.in_water)
  execute function private.plants_in_water_schedules();

-- График полива для растения в воде создаётся выключенным.
create or replace function private.care_schedules_in_water()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type = 'water' and exists (select 1 from public.plants where id = new.plant_id and in_water) then
    new.enabled := false;
  end if;
  return new;
end;
$$;

create trigger care_schedules_in_water
  before insert on public.care_schedules
  for each row execute function private.care_schedules_in_water();

-- ---------------------------------------------------------------------------
-- Настройки уведомлений в профиле
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column notify_care boolean not null default true,
  add column notify_messages boolean not null default true,
  add column notify_community boolean not null default true;

grant update (notify_care, notify_messages, notify_community) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Подписки браузеров
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  endpoint        text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh          text not null check (char_length(p256dh) <= 200),
  auth            text not null check (char_length(auth) <= 100),
  user_agent      text check (char_length(user_agent) <= 300),
  created_at      timestamptz not null default now(),
  last_success_at timestamptz
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_own_read on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy push_subscriptions_own_delete on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));
-- Добавляют подписку только через save_push_subscription (браузер мог принадлежать другому входу).
revoke insert, update on public.push_subscriptions from anon, authenticated;
revoke all on public.push_subscriptions from anon;

create or replace function private.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Нужно войти' using errcode = '42501';
  end if;
  if (select count(*) from public.push_subscriptions where user_id = auth.uid()) >= 10 then
    delete from public.push_subscriptions
     where id = (select id from public.push_subscriptions where user_id = auth.uid()
                  order by coalesce(last_success_at, created_at) limit 1);
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
     set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
         user_agent = excluded.user_agent, created_at = now();
end;
$$;

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language sql
security invoker
set search_path = public
as $$
  select private.save_push_subscription(p_endpoint, p_p256dh, p_auth, p_user_agent);
$$;

revoke execute on function public.save_push_subscription(text, text, text, text),
                           private.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text),
                          private.save_push_subscription(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Очередь уведомлений (читает и чистит только Edge Function под service_role)
-- ---------------------------------------------------------------------------

create table private.push_queue (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  body       text not null,
  url        text not null default '/today/',
  tag        text,
  created_at timestamptz not null default now(),
  sent_at    timestamptz,
  attempts   int not null default 0
);

create index push_queue_pending_idx on private.push_queue (created_at) where sent_at is null;
create index push_queue_user_idx on private.push_queue (user_id);
alter table private.push_queue enable row level security;
revoke all on private.push_queue from public, anon, authenticated;

-- Поставить уведомление в очередь, если человек его хочет и у него есть подписка.
create or replace function private.enqueue_push(p_user uuid, p_pref text, p_title text, p_body text, p_url text, p_tag text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into private.push_queue (user_id, title, body, url, tag)
  select p_user, left(p_title, 120), left(p_body, 240), p_url, p_tag
    from public.profiles p
   where p.id = p_user
     and case p_pref
           when 'care' then p.notify_care
           when 'messages' then p.notify_messages
           else p.notify_community
         end
     and exists (select 1 from public.push_subscriptions s where s.user_id = p_user);
$$;

revoke execute on function private.enqueue_push(uuid, text, text, text, text, text) from public, anon, authenticated;

create or replace function private.display_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(btrim(display_name), ''), regexp_replace(username, '_[0-9a-f]{8}$', ''), 'Садовод')
    from public.profiles where id = p_user;
$$;

revoke execute on function private.display_name(uuid) from public, anon, authenticated;

-- Новое сообщение → собеседнику.
create or replace function private.push_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.conversations;
begin
  select * into c from public.conversations where id = new.conversation_id;
  perform private.enqueue_push(
    case when new.sender_id = c.buyer_id then c.seller_id else c.buyer_id end,
    'messages',
    private.display_name(new.sender_id),
    new.body,
    '/messages/chat/?id=' || c.id,
    'chat-' || c.id);
  return new;
end;
$$;

create trigger messages_push after insert on public.messages
  for each row execute function private.push_on_message();

-- Ответ на вопрос или комментарий к записи → автору публикации.
create or replace function private.push_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.posts;
begin
  select * into p from public.posts where id = new.post_id and deleted_at is null;
  if p.id is null or p.author_id = new.author_id then
    return new;
  end if;
  perform private.enqueue_push(
    p.author_id,
    'community',
    case when p.kind = 'question' then 'Новый ответ на ваш вопрос' else 'Новый комментарий к записи' end,
    private.display_name(new.author_id) || ': ' || new.text,
    case when p.kind = 'question' then '/feed/question/?id=' || p.id
         when p.plant_id is not null then '/feed/plant/?id=' || p.plant_id
         else '/feed/' end,
    'post-' || p.id);
  return new;
end;
$$;

create trigger comments_push after insert on public.comments
  for each row execute function private.push_on_comment();

-- Ответ отмечен лучшим → автору ответа.
create or replace function private.push_on_solved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  answer_author uuid;
begin
  select author_id into answer_author from public.comments where id = new.solved_comment_id;
  if answer_author is not null and answer_author <> new.author_id then
    perform private.enqueue_push(
      answer_author, 'community', 'Ваш ответ — лучший 🌿',
      private.display_name(new.author_id) || ' отметил(а) ваш ответ как лучший',
      '/feed/question/?id=' || new.id, 'solved-' || new.id);
  end if;
  return new;
end;
$$;

create trigger posts_push_solved after update of solved_comment_id on public.posts
  for each row when (new.solved_comment_id is not null and new.solved_comment_id is distinct from old.solved_comment_id)
  execute function private.push_on_solved();

-- ---------------------------------------------------------------------------
-- Ежедневное напоминание об уходе — в выбранное время по часовому поясу человека
-- ---------------------------------------------------------------------------

create table private.care_reminder_log (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day     date not null,
  primary key (user_id, day)
);
alter table private.care_reminder_log enable row level security;
revoke all on private.care_reminder_log from public, anon, authenticated;

create or replace function private.enqueue_care_reminders()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  with people as (
    select p.id,
           (now() at time zone tz.name) as local_now,
           tz.name as tz
      from public.profiles p
      cross join lateral (
        select coalesce((select name from pg_timezone_names where name = p.timezone), 'UTC') as name) tz
     where p.notify_care
       and exists (select 1 from public.push_subscriptions s where s.user_id = p.id)
  ),
  ready as (
    select pe.* from people pe
     where pe.local_now::time >= (select reminder_time from public.profiles where id = pe.id)
       and not exists (select 1 from private.care_reminder_log l
                        where l.user_id = pe.id and l.day = pe.local_now::date)
  ),
  due as (
    select r.id as user_id, r.local_now::date as day,
           count(*) as tasks,
           string_agg(distinct pl.nickname, ', ') as names,
           count(distinct pl.id) as plants
      from ready r
      join public.plants pl on pl.owner_id = r.id and pl.deleted_at is null
                           and pl.status in ('alive', 'dormant')
      join public.care_schedules cs on cs.plant_id = pl.id and cs.enabled
     where cs.next_due_at < ((r.local_now::date + 1)::timestamp at time zone r.tz)
     group by r.id, r.local_now::date
  ),
  logged as (
    insert into private.care_reminder_log (user_id, day)
    select user_id, day from due
    on conflict do nothing
    returning user_id
  )
  insert into private.push_queue (user_id, title, body, url, tag)
  select d.user_id,
         'Пора позаботиться о растениях 🌿',
         case when d.plants <= 3 then d.names
              else split_part(d.names, ', ', 1) || ', ' || split_part(d.names, ', ', 2)
                   || ' и ещё ' || (d.plants - 2) end
           || ' · дел на сегодня: ' || d.tasks,
         '/today/',
         'care-' || d.day
    from due d
    join logged l on l.user_id = d.user_id;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function private.enqueue_care_reminders() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Доступ Edge Function push (только service_role)
-- ---------------------------------------------------------------------------

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'push_send_secret',
                           'Секрет для вызова push по расписанию')
 where not exists (select 1 from vault.secrets where name = 'push_send_secret');

create or replace function public.push_verify_secret(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_secret is not null and exists (
    select 1 from vault.decrypted_secrets where name = 'push_send_secret' and decrypted_secret = p_secret);
$$;

-- VAPID-ключи: читаются и один раз сохраняются самой функцией.
create or replace function public.push_vapid_keys()
returns table (public_key text, private_key text)
language sql
stable
security definer
set search_path = ''
as $$
  select (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_public_key'),
         (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_private_key');
$$;

create or replace function public.push_store_vapid_keys(p_public text, p_private text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from vault.secrets where name = 'vapid_private_key') then
    return;
  end if;
  perform vault.create_secret(p_private, 'vapid_private_key', 'VAPID: закрытый ключ Web Push');
  perform vault.create_secret(p_public, 'vapid_public_key', 'VAPID: открытый ключ Web Push');
end;
$$;

-- Порция неотправленных уведомлений с подписками; помечает попытку.
create or replace function public.push_take_batch(p_limit int default 100)
returns table (id bigint, title text, body text, url text, tag text, endpoint text, p256dh text, auth text, subscription_id uuid)
language sql
security definer
set search_path = public
as $$
  with batch as (
    update private.push_queue q
       set attempts = attempts + 1, sent_at = now()
     where q.id in (select id from private.push_queue
                     where sent_at is null and created_at > now() - interval '1 day'
                     order by created_at limit p_limit
                     for update skip locked)
    returning q.*
  )
  select b.id, b.title, b.body, b.url, b.tag, s.endpoint, s.p256dh, s.auth, s.id
    from batch b
    join public.push_subscriptions s on s.user_id = b.user_id;
$$;

create or replace function public.push_report(p_ok uuid[], p_gone uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.push_subscriptions set last_success_at = now() where id = any(p_ok);
  delete from public.push_subscriptions where id = any(p_gone);
  delete from private.push_queue where sent_at < now() - interval '7 days';
$$;

revoke execute on function public.push_verify_secret(text), public.push_vapid_keys(),
                           public.push_store_vapid_keys(text, text), public.push_take_batch(int),
                           public.push_report(uuid[], uuid[])
  from public, anon, authenticated;
grant execute on function public.push_verify_secret(text), public.push_vapid_keys(),
                          public.push_store_vapid_keys(text, text), public.push_take_batch(int),
                          public.push_report(uuid[], uuid[])
  to service_role;

-- Расписание: напоминания каждые 5 минут, отправка очереди — каждую минуту.
do $do$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron недоступен — расписание не создано';
    return;
  end if;
  create extension if not exists pg_net with schema extensions;
  create extension if not exists pg_cron;
  perform cron.schedule('push-care-reminders', '*/5 * * * *', 'select private.enqueue_care_reminders()');
  perform cron.schedule(
    'push-send-minutely',
    '* * * * *',
    $cron$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_send_secret')),
        body := '{"action":"send"}'::jsonb,
        timeout_milliseconds := 30000)
       where exists (select 1 from private.push_queue where sent_at is null);
    $cron$);
end
$do$;
