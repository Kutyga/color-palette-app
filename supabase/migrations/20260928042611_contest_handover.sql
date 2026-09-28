-- Вручение приза в розыгрышах.
--
-- При итогах база записывает каждому участнику место в очереди жеребьёвки (rank — порядок
-- по убыванию u, как и раньше). Первые winners_count становятся победителями, у каждого —
-- 72 часа, чтобы подтвердить «Забираю приз». Не подтвердил или отказался — приз переходит
-- следующему по очереди: тот же расчёт, поэтому передачу тоже может проверить любой.
-- Организатор отмечает «Приз передан», когда вручил.

alter table public.contest_entries
  add column rank           integer,
  add column claim_deadline timestamptz,
  add column claimed_at     timestamptz,
  add column delivered_at   timestamptz,
  -- Не подтвердил вовремя или отказался: место перешло следующему.
  add column forfeited_at   timestamptz;

-- Очередь для уже подведённых розыгрышей — из раскрытого секрета.
update public.contest_entries e set rank = r.rank
  from (select e2.contest_id, e2.user_id,
               row_number() over (partition by e2.contest_id
                                  order by private.draw_uniform(c.seed, e2.user_id) desc, e2.user_id) as rank
          from public.contest_entries e2
          join public.contests c on c.id = e2.contest_id
         where c.status = 'finished' and c.seed is not null) r
 where e.contest_id = r.contest_id and e.user_id = r.user_id;
update public.contest_entries set claim_deadline = now() + interval '72 hours'
 where place is not null and claim_deadline is null;

-- ---------------------------------------------------------------------------
-- Победитель получает место: срок на подтверждение, чат с организатором, push
-- ---------------------------------------------------------------------------
create or replace function private.award_place(p_contest uuid, p_user uuid, p_place smallint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.contests;
begin
  select * into c from public.contests where id = p_contest;
  update public.contest_entries
     set place = p_place, claim_deadline = now() + interval '72 hours'
   where contest_id = p_contest and user_id = p_user;
  insert into public.conversations (contest_id, buyer_id, seller_id)
  values (p_contest, p_user, c.organizer_id)
  on conflict do nothing;
  perform private.enqueue_push(p_user, 'community', 'Вы выиграли 🎉',
    'Розыгрыш «' || c.title || '»: приз — ' || c.prize || '. Подтвердите в течение 72 часов.',
    '/market/contest/?id=' || p_contest, 'contest-' || p_contest);
end;
$$;

-- Место переходит следующему по очереди, кто ещё не побеждал и не отказывался.
create or replace function private.pass_prize(p_contest uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.contests;
  vacated smallint;
  next_user uuid;
begin
  select * into c from public.contests where id = p_contest;
  select place into vacated from public.contest_entries
   where contest_id = p_contest and user_id = p_user and place is not null and delivered_at is null
   for update;
  if vacated is null then
    return;
  end if;
  update public.contest_entries set forfeited_at = now(), place = null
   where contest_id = p_contest and user_id = p_user;
  perform private.enqueue_push(p_user, 'community', 'Приз передан другому участнику',
    '«' || c.title || '»: приз перешёл следующему участнику по очереди жеребьёвки.',
    '/market/contest/?id=' || p_contest, 'contest-' || p_contest);
  select user_id into next_user from public.contest_entries
   where contest_id = p_contest and place is null and forfeited_at is null
   order by rank limit 1;
  if next_user is not null then
    perform private.award_place(p_contest, next_user, vacated);
  end if;
  perform private.enqueue_push(c.organizer_id, 'community', 'Приз перешёл следующему',
    '«' || c.title || '»: ' || case when next_user is null then 'участников больше нет — место свободно.'
                                    else 'новый победитель выбран по той же жеребьёвке.' end,
    '/market/contest/?id=' || p_contest, 'contest-' || p_contest);
end;
$$;

-- ---------------------------------------------------------------------------
-- Итоги: очередь всем участникам, места — первым в очереди
-- ---------------------------------------------------------------------------
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

  update public.contest_entries e set rank = r.rank
    from (select user_id, row_number() over (order by private.draw_uniform(s, user_id) desc, user_id) as rank
            from public.contest_entries where contest_id = p_contest) r
   where e.contest_id = p_contest and e.user_id = r.user_id;

  update public.contests set status = 'finished', seed = s, finished_at = now() where id = p_contest;

  for w in select user_id, rank from public.contest_entries
            where contest_id = p_contest and rank <= c.winners_count order by rank loop
    perform private.award_place(p_contest, w.user_id, w.rank::smallint);
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

-- Тот же запуск pg_cron раз в 5 минут: итоги и передача неподтверждённых призов.
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
  for c in select contest_id, user_id from public.contest_entries
            where place is not null and claimed_at is null and claim_deadline <= now() loop
    perform private.pass_prize(c.contest_id, c.user_id);
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Действия победителя и организатора
-- ---------------------------------------------------------------------------
create or replace function private.claim_prize(p_contest uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.contests;
begin
  update public.contest_entries set claimed_at = now()
   where contest_id = p_contest and user_id = (select auth.uid())
     and place is not null and claimed_at is null and claim_deadline > now();
  if not found then
    raise exception 'Подтвердить нельзя: вы не победитель или срок вышел' using errcode = '23514';
  end if;
  select * into c from public.contests where id = p_contest;
  perform private.enqueue_push(c.organizer_id, 'community', 'Победитель на связи',
    '«' || c.title || '»: победитель подтвердил, что забирает приз.',
    '/market/contest/?id=' || p_contest, 'contest-' || p_contest);
end;
$$;

create or replace function private.decline_prize(p_contest uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.contest_entries
                  where contest_id = p_contest and user_id = (select auth.uid())
                    and place is not null and delivered_at is null) then
    raise exception 'Отказаться нельзя: вы не победитель' using errcode = '23514';
  end if;
  perform private.pass_prize(p_contest, (select auth.uid()));
end;
$$;

create or replace function private.mark_prize_delivered(p_contest uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.contests;
begin
  select * into c from public.contests where id = p_contest;
  if c.organizer_id is distinct from (select auth.uid()) then
    raise exception 'Отметить вручение может только организатор' using errcode = '42501';
  end if;
  update public.contest_entries set delivered_at = now()
   where contest_id = p_contest and user_id = p_user
     and place is not null and claimed_at is not null and delivered_at is null;
  if not found then
    raise exception 'Сначала победитель должен подтвердить, что забирает приз' using errcode = '23514';
  end if;
  perform private.enqueue_push(p_user, 'community', 'Приз вручён 🎁',
    '«' || c.title || '»: организатор отметил, что передал приз.',
    '/market/contest/?id=' || p_contest, 'contest-' || p_contest);
end;
$$;

-- ---------------------------------------------------------------------------
-- Участники: очередь и статус вручения
-- ---------------------------------------------------------------------------
drop function public.contest_participants(uuid);
drop function private.contest_participants(uuid);

create function private.contest_participants(p_contest uuid)
returns table (user_id uuid, username text, display_name text, rank integer, place smallint,
               claim_deadline timestamptz, claimed_at timestamptz, delivered_at timestamptz,
               forfeited_at timestamptz, joined_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select e.user_id, p.username, coalesce(nullif(btrim(p.display_name), ''), p.username),
         e.rank, e.place, e.claim_deadline, e.claimed_at, e.delivered_at, e.forfeited_at, e.created_at
    from public.contest_entries e
    join public.profiles p on p.id = e.user_id
   where e.contest_id = p_contest
   order by e.place nulls last, e.rank nulls last, e.created_at;
$$;

create function public.contest_participants(p_contest uuid)
returns table (user_id uuid, username text, display_name text, rank integer, place smallint,
               claim_deadline timestamptz, claimed_at timestamptz, delivered_at timestamptz,
               forfeited_at timestamptz, joined_at timestamptz)
language sql security invoker set search_path = public as $$ select * from private.contest_participants(p_contest); $$;

create or replace function public.claim_prize(p_contest uuid) returns void
language sql security invoker set search_path = public as $$ select private.claim_prize(p_contest); $$;
create or replace function public.decline_prize(p_contest uuid) returns void
language sql security invoker set search_path = public as $$ select private.decline_prize(p_contest); $$;
create or replace function public.mark_prize_delivered(p_contest uuid, p_user uuid) returns void
language sql security invoker set search_path = public as $$ select private.mark_prize_delivered(p_contest, p_user); $$;

revoke execute on function
  public.contest_participants(uuid), public.claim_prize(uuid), public.decline_prize(uuid),
  public.mark_prize_delivered(uuid, uuid),
  private.contest_participants(uuid), private.claim_prize(uuid), private.decline_prize(uuid),
  private.mark_prize_delivered(uuid, uuid)
from public, anon;
grant execute on function
  public.contest_participants(uuid), public.claim_prize(uuid), public.decline_prize(uuid),
  public.mark_prize_delivered(uuid, uuid),
  private.contest_participants(uuid), private.claim_prize(uuid), private.decline_prize(uuid),
  private.mark_prize_delivered(uuid, uuid)
to authenticated;
revoke execute on function private.award_place(uuid, uuid, smallint), private.pass_prize(uuid, uuid)
from public, anon, authenticated;
