-- Геймификация: статистика садовника, из которой клиент выводит уровни и достижения
-- (mobile/lib/features/gamification). Считается на сервере по журналу ухода,
-- поэтому достижения нельзя «накрутить» с клиента.

create or replace function public.my_garden_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select id, coalesce(timezone, 'UTC') as tz from public.profiles where id = auth.uid()
  ),
  my_plants as (
    select p.*, s.toxic_to_pets, s.plant_type
      from public.plants p
      join me on p.owner_id = me.id
      left join public.species s on s.id = p.species_id
     where p.deleted_at is null and p.status in ('alive', 'dormant')
  ),
  my_events as (
    select e.type, (e.performed_at at time zone me.tz) as local_at
      from public.care_events e
      join me on e.performed_by = me.id
  ),
  days as (
    select distinct local_at::date as d from my_events
  ),
  islands as (
    select d, d - (row_number() over (order by d))::int as grp from days
  ),
  streaks as (
    select min(d) as first_day, max(d) as last_day, count(*)::int as len from islands group by grp
  ),
  today as (
    select (now() at time zone me.tz)::date as d from me
  )
  select jsonb_build_object(
    'plants',        (select count(*) from my_plants),
    'species',       (select count(distinct species_id) from my_plants),
    'locations',     (select count(*) from public.locations l join me on l.owner_id = me.id where l.deleted_at is null),
    'pet_safe',      (select count(*) from my_plants where toxic_to_pets = false),
    'succulents',    (select count(*) from my_plants where plant_type = 'суккулент'),
    'care_events',   (select count(*) from my_events),
    'waterings',     (select count(*) from my_events where type = 'water'),
    'fertilizings',  (select count(*) from my_events where type = 'fertilize'),
    'mistings',      (select count(*) from my_events where type = 'mist'),
    'repots',        (select count(*) from my_events where type = 'repot'),
    'early_bird',    (select count(*) from my_events where extract(hour from local_at) between 5 and 7),
    'night_owl',     (select count(*) from my_events where extract(hour from local_at) >= 23
                                                       or extract(hour from local_at) < 4),
    -- Серия жива, если последний день ухода — сегодня или вчера.
    'current_streak', coalesce((select s.len from streaks s, today t
                                 where s.last_day >= t.d - 1 order by s.last_day desc limit 1), 0),
    'best_streak',   coalesce((select max(len) from streaks), 0)
  );
$$;

revoke execute on function public.my_garden_stats() from anon;
