-- Отмена ошибочной отметки ухода: удаление последней отметки возвращает график как было —
-- дату последнего ухода и коэффициент подстройки, запомненные в момент отметки.
-- Удалить может автор отметки или владелец растения.

alter table public.care_events
  add column prev_factor numeric(4, 2),
  add column prev_done_at timestamptz;

create or replace function private.care_events_remember_factor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select user_factor, last_done_at into new.prev_factor, new.prev_done_at
    from public.care_schedules
   where plant_id = new.plant_id and type = new.type;
  return new;
end;
$$;

create trigger care_events_remember_factor before insert on public.care_events
  for each row execute function private.care_events_remember_factor();

create or replace function private.care_events_undo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.care_schedules;
begin
  select * into s from public.care_schedules
   where plant_id = old.plant_id and type = old.type
   for update;
  -- Пересчитываем только если удалена та отметка, от которой считается график.
  if not found or s.last_done_at is distinct from old.performed_at then
    return old;
  end if;
  update public.care_schedules
     set last_done_at = old.prev_done_at,
         user_factor = coalesce(old.prev_factor, user_factor)
   where id = s.id;
  return old;
end;
$$;

create trigger care_events_undo after delete on public.care_events
  for each row execute function private.care_events_undo();

create policy events_delete_owner on public.care_events for delete to authenticated
  using (private.owns_plant(plant_id));
