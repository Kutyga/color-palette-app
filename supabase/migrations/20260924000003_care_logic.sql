-- Расчёт графика ухода, счётчики и RPC.
-- Формула расчёта интервала продублирована в клиенте
-- (mobile/lib/features/care/domain/care_interval_calculator.dart) — менять синхронно.

-- ---------------------------------------------------------------------------
-- Коэффициенты
-- ---------------------------------------------------------------------------

create or replace function public.season_factor(p_month int, p_hemisphere char)
returns numeric
language sql
immutable
as $$
  select case
    -- в южном полушарии сезоны сдвинуты на полгода
    when (case when p_hemisphere = 'S' then (p_month + 5) % 12 + 1 else p_month end)
         in (12, 1, 2) then 1.4     -- зима: период покоя, поливаем реже
    when (case when p_hemisphere = 'S' then (p_month + 5) % 12 + 1 else p_month end)
         in (6, 7, 8) then 0.85     -- лето: активный рост, поливаем чаще
    else 1.0
  end;
$$;

create or replace function public.pot_factor(p_material text)
returns numeric
language sql
immutable
as $$
  select case p_material
    when 'terracotta' then 0.85   -- пористая глина быстро отдаёт влагу
    when 'plastic'    then 1.1
    when 'glass'      then 1.1
    else 1.0
  end;
$$;

create or replace function public.light_factor(p_light text)
returns numeric
language sql
immutable
as $$
  select case p_light
    when 'low'    then 1.25
    when 'medium' then 1.1
    when 'direct' then 0.85
    else 1.0
  end;
$$;

-- Эффективный интервал в днях для конкретного графика в момент времени p_at.
create or replace function public.effective_interval_days(
  p_type        public.care_type,
  p_interval    numeric,
  p_user_factor numeric,
  p_auto_adjust boolean,
  p_month       int,
  p_hemisphere  char,
  p_pot         text,
  p_light       text
)
returns numeric
language sql
immutable
as $$
  select greatest(0.5, round(
    p_interval * p_user_factor *
    case
      when not p_auto_adjust then 1.0
      when p_type = 'water' then
        public.season_factor(p_month, p_hemisphere)
        * public.pot_factor(p_pot)
        * public.light_factor(p_light)
      when p_type = 'mist' then public.season_factor(p_month, p_hemisphere)
      else 1.0
    end, 1));
$$;

create or replace function public.schedule_interval_days(s public.care_schedules, p_at timestamptz)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select public.effective_interval_days(
    s.type, s.interval_days, s.user_factor, s.auto_adjust,
    extract(month from p_at at time zone coalesce(pr.timezone, 'UTC'))::int,
    coalesce(pr.hemisphere, 'N'),
    p.pot_material,
    l.light_level)
  from public.plants p
  join public.profiles pr on pr.id = p.owner_id
  left join public.locations l on l.id = p.location_id
  where p.id = s.plant_id;
$$;

-- ---------------------------------------------------------------------------
-- Пересчёт next_due_at
-- ---------------------------------------------------------------------------

create or replace function public.care_schedules_compute_due()
returns trigger
language plpgsql
as $$
declare
  base timestamptz := coalesce(new.last_done_at, now());
begin
  new.next_due_at := base
    + make_interval(secs => (public.schedule_interval_days(new, base) * 86400)::double precision);
  return new;
end;
$$;

create trigger care_schedules_compute_due
  before insert or update of interval_days, user_factor, auto_adjust, last_done_at
  on public.care_schedules
  for each row execute function public.care_schedules_compute_due();

-- Новое событие ухода сдвигает график и подстраивает коэффициент под привычки пользователя.
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
    expected := public.schedule_interval_days(s, s.last_done_at);
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

create trigger care_events_apply after insert on public.care_events
  for each row execute function public.care_events_apply();

-- Смена горшка или места влияет на интервал — пересчитываем графики.
create or replace function public.plants_recompute_schedules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.care_schedules
     set last_done_at = last_done_at   -- «касание» запускает care_schedules_compute_due
   where plant_id = new.id;
  return new;
end;
$$;

create trigger plants_recompute_schedules
  after update of pot_material, location_id on public.plants
  for each row execute function public.plants_recompute_schedules();

create or replace function public.locations_recompute_schedules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.care_schedules cs
     set last_done_at = cs.last_done_at
    from public.plants p
   where p.id = cs.plant_id and p.location_id = new.id;
  return new;
end;
$$;

create trigger locations_recompute_schedules
  after update of light_level on public.locations
  for each row execute function public.locations_recompute_schedules();

-- ---------------------------------------------------------------------------
-- Денормализованные счётчики
-- ---------------------------------------------------------------------------

create or replace function public.posts_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  else
    update public.posts set like_count = greatest(0, like_count - 1) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger likes_count after insert or delete on public.likes
  for each row execute function public.posts_like_count();

create or replace function public.posts_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' or (new.deleted_at is not null and old.deleted_at is null) then
    update public.posts set comment_count = greatest(0, comment_count - 1)
     where id = coalesce(new.post_id, old.post_id);
  end if;
  return null;
end;
$$;

create trigger comments_count after insert or delete or update of deleted_at on public.comments
  for each row execute function public.posts_comment_count();

-- ---------------------------------------------------------------------------
-- RPC (security invoker — RLS применяется)
-- ---------------------------------------------------------------------------

-- Поиск по базе знаний: латинские и народные названия, синонимы, с опечатками.
create or replace function public.search_species(q text, lim int default 20)
returns setof public.species
language sql
stable
as $$
  select s.*
    from public.species s
   where s.search_text like '%' || lower(q) || '%'
      or s.search_tsv @@ plainto_tsquery('simple', q)
      or word_similarity(lower(q), s.search_text) > 0.4
   order by (s.search_text like '%' || lower(q) || '%') desc,
            word_similarity(lower(q), s.search_text) desc,
            s.latin_name
   limit least(lim, 50);
$$;

-- Что нужно сделать до p_until: свои растения и те, где я помощник.
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
as $$
  select cs.id, p.id, p.nickname, cs.type, cs.next_due_at, cs.last_done_at,
         cs.next_due_at < now()
    from public.care_schedules cs
    join public.plants p on p.id = cs.plant_id
   where cs.enabled
     and p.deleted_at is null
     and p.status in ('alive', 'dormant')
     and cs.next_due_at <= p_until
     and public.can_care_plant(p.id)
   order by cs.next_due_at;
$$;

-- Лента подписок с курсорной пагинацией по (created_at, id).
create or replace function public.feed_following(
  before_ts timestamptz default null,
  before_id uuid default null,
  lim int default 20
)
returns setof public.posts
language sql
stable
as $$
  select p.*
    from public.posts p
   where p.deleted_at is null
     and (p.author_id = auth.uid()
          or p.author_id in (select followee_id from public.follows where follower_id = auth.uid()))
     and (before_ts is null or (p.created_at, p.id) < (before_ts, before_id))
   order by p.created_at desc, p.id desc
   limit least(lim, 50);
$$;

-- «Интересное»: популярные публичные посты за неделю с затуханием по времени.
create or replace function public.feed_discover(lim int default 20, off int default 0)
returns setof public.posts
language sql
stable
as $$
  select p.*
    from public.posts p
   where p.deleted_at is null
     and p.visibility = 'public'
     and p.created_at > now() - interval '7 days'
   order by (p.like_count + 2 * p.comment_count + 1)
            / power(extract(epoch from (now() - p.created_at)) / 3600 + 2, 1.5) desc
   limit least(lim, 50) offset off;
$$;
