-- Конкурсы в барахолке: розыгрыши призов с честной проверяемой жеребьёвкой.
--
-- Правила (те же числа — в web/src/lib/domain/contest.ts, CONTEST_RULES):
--   • участвовать может аккаунт старше 7 дней, у которого в коллекции есть растение со своим фото;
--   • без доставки — только из того же города; организатор в своём розыгрыше не участвует;
--   • шансы у всех участников равны — ничем их не повысить;
--   • проводить розыгрыш может любой, одновременно — один (у администратора ограничения нет,
--     его конкурсы закреплены сверху).
--
-- Честность: при создании база генерирует секрет и сразу публикует его SHA-256 (seed_hash).
-- После окончания секрет раскрывается (seed). Каждому участнику — число
-- u = (первые 52 бита sha256(seed || ':' || user_id) + 0,5) / 2^52; побеждают наибольшие u.
-- Любой может пересчитать итог сам: организатор не может выбрать победителя.

-- ---------------------------------------------------------------------------
-- Конкурсы и заявки
-- ---------------------------------------------------------------------------
create table public.contests (
  id            uuid primary key default gen_random_uuid(),
  organizer_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title         text not null check (char_length(btrim(title)) between 3 and 80),
  prize         text not null check (char_length(btrim(prize)) between 2 and 120),
  description   text not null default '' check (char_length(description) <= 1000),
  photo_path    text,
  city          text not null check (char_length(btrim(city)) between 2 and 60),
  delivery      boolean not null default false,
  winners_count smallint not null default 1 check (winners_count between 1 and 5),
  ends_at       timestamptz not null,
  -- Ставит триггер: конкурсы администратора закреплены сверху.
  pinned        boolean not null default false,
  status        text not null default 'active' check (status in ('active', 'finished', 'cancelled')),
  seed_hash     text not null default '',
  -- Раскрывается при подведении итогов.
  seed          text,
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
);
create index contests_organizer_idx on public.contests (organizer_id);
create index contests_active_idx on public.contests (ends_at) where status = 'active';

-- Секрет до окончания хранится отдельно: из браузера его не прочитать.
create table private.contest_seeds (
  contest_id uuid primary key references public.contests(id) on delete cascade deferrable initially deferred,
  seed       text not null
);
revoke all on private.contest_seeds from public, anon, authenticated;

create table public.contest_entries (
  contest_id uuid not null references public.contests(id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Место победителя — ставится при подведении итогов.
  place      smallint,
  primary key (contest_id, user_id)
);
create index contest_entries_user_idx on public.contest_entries (user_id);

-- Чат победителя с организатором — тот же, что у объявлений.
alter table public.conversations add column contest_id uuid references public.contests(id) on delete set null;
create unique index conversations_contest_buyer_key on public.conversations (contest_id, buyer_id) where contest_id is not null;

-- ---------------------------------------------------------------------------
-- Создание: проверки и секрет
-- ---------------------------------------------------------------------------
create or replace function private.contests_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  seed text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if new.organizer_id is distinct from auth.uid() then
    raise exception 'Конкурс можно создать только от своего имени' using errcode = '42501';
  end if;
  if new.ends_at < now() + interval '1 hour' or new.ends_at > now() + interval '30 days' then
    raise exception 'Розыгрыш длится от часа до 30 дней' using errcode = '23514';
  end if;
  new.pinned := private.is_admin();
  if not new.pinned and exists (select 1 from public.contests
                                 where organizer_id = new.organizer_id and status = 'active') then
    raise exception 'Одновременно можно проводить один розыгрыш' using errcode = '23514';
  end if;
  new.status := 'active';
  new.seed := null;
  new.finished_at := null;
  new.seed_hash := encode(sha256(convert_to(seed, 'UTF8')), 'hex');
  insert into private.contest_seeds (contest_id, seed) values (new.id, seed);
  return new;
end;
$$;

create trigger contests_before_insert
  before insert on public.contests
  for each row execute function private.contests_before_insert();

-- ---------------------------------------------------------------------------
-- Участие
-- ---------------------------------------------------------------------------
create or replace function private.join_contest(p_contest uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  c public.contests;
  my public.profiles;
begin
  if me is null then
    raise exception 'Нужно войти' using errcode = '42501';
  end if;
  select * into c from public.contests where id = p_contest;
  if c.id is null or c.status <> 'active' or c.ends_at <= now() then
    raise exception 'Розыгрыш уже закончился' using errcode = '23514';
  end if;
  if c.organizer_id = me then
    raise exception 'В своём розыгрыше участвовать нельзя' using errcode = '23514';
  end if;
  if exists (select 1 from public.blocks
              where (blocker_id = me and blocked_id = c.organizer_id)
                 or (blocker_id = c.organizer_id and blocked_id = me)) then
    raise exception 'Участвовать в этом розыгрыше нельзя' using errcode = '42501';
  end if;
  select * into my from public.profiles where id = me;
  if my.created_at > now() - interval '7 days' then
    raise exception 'Участвовать можно через 7 дней после регистрации' using errcode = '23514';
  end if;
  if not exists (select 1 from public.plants
                  where owner_id = me and deleted_at is null and cover_photo_id is not null) then
    raise exception 'Добавьте в коллекцию растение со своим фото' using errcode = '23514';
  end if;
  if not c.delivery and lower(btrim(coalesce(my.city, ''))) <> lower(btrim(c.city)) then
    raise exception 'Без доставки — только для садоводов из города %', c.city using errcode = '23514';
  end if;
  insert into public.contest_entries (contest_id, user_id) values (p_contest, me)
  on conflict do nothing;
end;
$$;

create or replace function private.leave_contest(p_contest uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.contest_entries e
   using public.contests c
   where e.contest_id = p_contest and e.user_id = (select auth.uid())
     and c.id = e.contest_id and c.status = 'active';
$$;

-- Отменить: организатор — пока никто не участвует, администратор — всегда.
create or replace function private.cancel_contest(p_contest uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.contests c set status = 'cancelled', finished_at = now()
   where c.id = p_contest and c.status = 'active'
     and (private.is_admin()
          or (c.organizer_id = (select auth.uid())
              and not exists (select 1 from public.contest_entries e where e.contest_id = c.id)));
  if not found then
    raise exception 'Отменить нельзя: в розыгрыше уже есть участники' using errcode = '23514';
  end if;
end;
$$;

-- Участники: список открыт всем — часть прозрачности.
create or replace function private.contest_participants(p_contest uuid)
returns table (user_id uuid, username text, display_name text, place smallint, joined_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select e.user_id, p.username, coalesce(nullif(btrim(p.display_name), ''), p.username),
         e.place, e.created_at
    from public.contest_entries e
    join public.profiles p on p.id = e.user_id
   where e.contest_id = p_contest
   order by e.place nulls last, e.created_at;
$$;

-- ---------------------------------------------------------------------------
-- Подведение итогов
-- ---------------------------------------------------------------------------

-- Равномерное число из (0; 1) по секрету и участнику — тот же расчёт делает браузер.
create or replace function private.draw_uniform(p_seed text, p_user uuid)
returns double precision
language sql
immutable
set search_path = public
as $$
  select (('x' || lpad(substr(encode(sha256(convert_to(p_seed || ':' || p_user::text, 'UTF8')), 'hex'), 1, 13), 16, '0'))::bit(64)::bigint
          + 0.5) / 4503599627370496.0;
$$;

create or replace function private.finish_contest(p_contest uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.contests;
  s text;
  w record;
begin
  select * into c from public.contests where id = p_contest and status = 'active' for update;
  if c.id is null then
    return;
  end if;
  select seed into s from private.contest_seeds where contest_id = p_contest;

  update public.contest_entries e set place = r.place
    from (select user_id,
                 row_number() over (order by private.draw_uniform(s, user_id) desc, user_id) as place
            from public.contest_entries where contest_id = p_contest) r
   where e.contest_id = p_contest and e.user_id = r.user_id and r.place <= c.winners_count;

  update public.contests set status = 'finished', seed = s, finished_at = now() where id = p_contest;

  for w in select user_id from public.contest_entries where contest_id = p_contest and place is not null loop
    insert into public.conversations (contest_id, buyer_id, seller_id)
    values (p_contest, w.user_id, c.organizer_id)
    on conflict do nothing;
    perform private.enqueue_push(w.user_id, 'community', 'Вы выиграли 🎉',
      'Розыгрыш «' || c.title || '»: приз — ' || c.prize || '. Напишите организатору.',
      '/market/contest/?id=' || p_contest, 'contest-' || p_contest);
  end loop;
  perform private.enqueue_push(c.organizer_id, 'community', 'Итоги розыгрыша',
    '«' || c.title || '»: победители выбраны — договоритесь о вручении в сообщениях.',
    '/market/contest/?id=' || p_contest, 'contest-' || p_contest);
  perform private.enqueue_push(e.user_id, 'community', 'Итоги розыгрыша',
    '«' || c.title || '»: победители выбраны. Спасибо за участие!',
    '/market/contest/?id=' || p_contest, 'contest-' || p_contest)
    from public.contest_entries e where e.contest_id = p_contest and e.place is null;
end;
$$;

create or replace function private.finish_due_contests()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  c record;
begin
  for c in select id from public.contests where status = 'active' and ends_at <= now() loop
    perform private.finish_contest(c.id);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Чат победителя подписывается названием розыгрыша (фото объявления у него нет).
create or replace function public.my_conversations()
returns table (
  id uuid,
  listing_id uuid,
  listing_title text,
  listing_kind text,
  listing_status text,
  listing_photo text,
  i_am_seller boolean,
  other_id uuid,
  other_username text,
  other_display_name text,
  last_message text,
  last_message_at timestamptz,
  last_from_me boolean,
  unread boolean,
  blocked boolean
)
language sql
stable
set search_path = public
as $$
  select c.id,
         c.listing_id,
         coalesce(l.title, '🎉 ' || ct.title),
         l.kind,
         l.status,
         coalesce(l.photo_paths[1], ct.photo_path),
         c.seller_id = (select auth.uid()),
         case when c.seller_id = (select auth.uid()) then c.buyer_id else c.seller_id end,
         coalesce(o.username, 'sadovod'),
         coalesce(nullif(btrim(o.display_name), ''), o.username, 'Садовод'),
         c.last_message,
         coalesce(c.last_message_at, c.created_at),
         c.last_sender_id = (select auth.uid()),
         c.last_message_at is not null
           and c.last_sender_id is distinct from (select auth.uid())
           and c.last_message_at > coalesce(
                 case when c.seller_id = (select auth.uid()) then c.seller_read_at else c.buyer_read_at end,
                 '-infinity'),
         not private.can_message(c.id)
    from public.conversations c
    left join public.profiles o
      on o.id = case when c.seller_id = (select auth.uid()) then c.buyer_id else c.seller_id end
    left join public.listings l on l.id = c.listing_id
    left join public.contests ct on ct.id = c.contest_id
   where (select auth.uid()) in (c.buyer_id, c.seller_id)
   order by coalesce(c.last_message_at, c.created_at) desc
   limit 100;
$$;

-- ---------------------------------------------------------------------------
-- Доступ
-- ---------------------------------------------------------------------------
alter table public.contests enable row level security;
alter table public.contest_entries enable row level security;
revoke all on public.contests, public.contest_entries from anon;
revoke update, delete on public.contests from authenticated;
revoke insert, update, delete on public.contest_entries from authenticated;

-- Отменённые видят только организатор и администратор.
create policy contests_read on public.contests for select to authenticated
  using (status <> 'cancelled' or organizer_id = (select auth.uid()) or private.is_admin());
create policy contests_insert on public.contests for insert to authenticated
  with check (organizer_id = (select auth.uid()));
-- Участники открыты всем: список — часть прозрачности.
create policy contest_entries_read on public.contest_entries for select to authenticated
  using (true);

-- Обёртки с правами вызывающего (помощники с правами владельца — в private).
create or replace function public.join_contest(p_contest uuid) returns void
language sql security invoker set search_path = public as $$ select private.join_contest(p_contest); $$;
create or replace function public.leave_contest(p_contest uuid) returns void
language sql security invoker set search_path = public as $$ select private.leave_contest(p_contest); $$;
create or replace function public.cancel_contest(p_contest uuid) returns void
language sql security invoker set search_path = public as $$ select private.cancel_contest(p_contest); $$;
create or replace function public.contest_participants(p_contest uuid)
returns table (user_id uuid, username text, display_name text, place smallint, joined_at timestamptz)
language sql security invoker set search_path = public as $$ select * from private.contest_participants(p_contest); $$;

revoke execute on function
  public.join_contest(uuid), public.leave_contest(uuid), public.cancel_contest(uuid),
  public.contest_participants(uuid),
  private.join_contest(uuid), private.leave_contest(uuid), private.cancel_contest(uuid),
  private.contest_participants(uuid)
from public, anon;
grant execute on function
  public.join_contest(uuid), public.leave_contest(uuid), public.cancel_contest(uuid),
  public.contest_participants(uuid),
  private.join_contest(uuid), private.leave_contest(uuid), private.cancel_contest(uuid),
  private.contest_participants(uuid)
to authenticated;
-- Подведение итогов и секреты — только сервер.
revoke execute on function
  private.finish_contest(uuid), private.finish_due_contests(), private.draw_uniform(text, uuid)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Итоги — каждые 5 минут
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron недоступен — расписание не создано';
    return;
  end if;
  create extension if not exists pg_cron;
  perform cron.schedule('contests-finish', '*/5 * * * *', 'select private.finish_due_contests()');
end $$;
