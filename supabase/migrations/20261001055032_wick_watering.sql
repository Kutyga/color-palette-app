-- Фитильный полив: растение пьёт из резервуара через фитиль — график полива не нужен
-- (как у растения в воде). Режимы взаимоисключающие: в воде или на фитиле.

alter table public.plants add column wick boolean not null default false;
alter table public.plants add constraint plants_water_mode check (not (in_water and wick));

-- Переключатели «в воде» и «на фитиле» выключают (и включают обратно) график полива.
create or replace function private.plants_in_water_schedules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.care_schedules
     set enabled = not (new.in_water or new.wick)
   where plant_id = new.id and type = 'water';
  return new;
end;
$$;

drop trigger plants_in_water_schedules on public.plants;
create trigger plants_in_water_schedules
  after update of in_water, wick on public.plants
  for each row when (old.in_water is distinct from new.in_water or old.wick is distinct from new.wick)
  execute function private.plants_in_water_schedules();

-- График полива для растения в воде или на фитиле создаётся выключенным.
create or replace function private.care_schedules_in_water()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type = 'water' and exists (select 1 from public.plants where id = new.plant_id and (in_water or wick)) then
    new.enabled := false;
  end if;
  return new;
end;
$$;
