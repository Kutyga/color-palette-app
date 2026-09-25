-- Помощники RLS переезжают в схему private: она не публикуется через Data API,
-- поэтому функции нельзя вызвать как /rest/v1/rpc/..., а правила доступа продолжают
-- их использовать (политики ссылаются на функцию, а не на её имя).
-- my_garden_stats остаётся публичным RPC намеренно: отдаёт только данные вызывающего.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.is_blocked_by(uuid)          set schema private;
alter function public.can_view(uuid, text)         set schema private;
alter function public.is_caretaker(uuid)           set schema private;
alter function public.can_view_plant(uuid)         set schema private;
alter function public.can_care_plant(uuid)         set schema private;
alter function public.owns_plant(uuid)             set schema private;
alter function public.can_view_post(uuid)          set schema private;
alter function public.schedule_interval_days(public.care_schedules, timestamptz) set schema private;

-- Тела SQL-функций хранятся текстом — обновляем ссылки на перенесённые помощники.

create or replace function private.can_view(p_owner uuid, p_visibility text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_owner = auth.uid()
      or (
        auth.uid() is not null
        and not private.is_blocked_by(p_owner)
        and (
          p_visibility = 'public'
          or (p_visibility = 'followers' and exists (
                select 1 from public.follows
                 where follower_id = auth.uid() and followee_id = p_owner))
        )
      );
$$;

create or replace function private.can_view_plant(p_plant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.plants p
     where p.id = p_plant
       and (private.can_view(p.owner_id, p.visibility) or private.is_caretaker(p.id))
       and (p.deleted_at is null or p.owner_id = auth.uid()));
$$;

create or replace function private.can_care_plant(p_plant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.plants p
     where p.id = p_plant
       and (p.owner_id = auth.uid() or private.is_caretaker(p.id)));
$$;

create or replace function private.can_view_post(p_post uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.posts
     where id = p_post
       and deleted_at is null
       and private.can_view(author_id, visibility));
$$;

create or replace function public.care_schedules_compute_due()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  base timestamptz := coalesce(new.last_done_at, now());
begin
  new.next_due_at := base
    + make_interval(secs => (private.schedule_interval_days(new, base) * 86400)::double precision);
  return new;
end;
$$;

create or replace function public.care_events_apply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.care_schedules;
  expected numeric;
  actual numeric;
  ratio numeric;
  new_factor numeric;
begin
  select * into s from public.care_schedules
   where plant_id = new.plant_id and type = new.type
   for update;

  if not found then
    return new;
  end if;

  -- Событие задним числом (синхронизация с другого устройства) не должно откатывать график.
  if s.last_done_at is not null and new.performed_at <= s.last_done_at then
    return new;
  end if;

  new_factor := s.user_factor;
  if s.auto_adjust and s.last_done_at is not null then
    expected := private.schedule_interval_days(s, s.last_done_at);
    actual := extract(epoch from (new.performed_at - s.last_done_at)) / 86400.0;
    ratio := actual / expected;
    -- Сильные отклонения (забыли на две недели / полили дважды) не учитываем.
    if ratio between 0.5 and 1.5 then
      new_factor := least(3.0, greatest(0.3, round(s.user_factor * (0.8 + 0.2 * ratio), 2)));
    end if;
  end if;

  update public.care_schedules
     set last_done_at = new.performed_at,
         user_factor = new_factor
   where id = s.id;

  return new;
end;
$$;

create or replace function public.care_due(p_until timestamptz default now() + interval '1 day')
returns table (
  schedule_id  uuid,
  plant_id     uuid,
  nickname     text,
  type         public.care_type,
  next_due_at  timestamptz,
  last_done_at timestamptz,
  overdue      boolean
)
language sql
stable
set search_path = public, extensions
as $$
  select cs.id, p.id, p.nickname, cs.type, cs.next_due_at, cs.last_done_at,
         cs.next_due_at < now()
    from public.care_schedules cs
    join public.plants p on p.id = cs.plant_id
   where cs.enabled
     and p.deleted_at is null
     and p.status in ('alive', 'dormant')
     and cs.next_due_at <= p_until
     and private.can_care_plant(p.id)
   order by cs.next_due_at;
$$;

-- create or replace сохраняет права, но повторим явно: помощники — только для вошедших.
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- Индексы на внешних ключах, по которым идут частые выборки и каскадные удаления.
create index if not exists plants_location_idx         on public.plants (location_id);
create index if not exists care_events_performed_by_idx on public.care_events (performed_by);
create index if not exists likes_post_idx              on public.likes (post_id);
create index if not exists blocks_blocked_idx          on public.blocks (blocked_id);
create index if not exists plant_caretakers_user_idx   on public.plant_caretakers (user_id);
create index if not exists posts_plant_idx             on public.posts (plant_id);
create index if not exists comments_author_idx         on public.comments (author_id);
create index if not exists news_articles_source_idx    on public.news_articles (source_id);
create index if not exists devices_user_idx            on public.devices (user_id);
