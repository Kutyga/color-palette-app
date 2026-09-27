-- Место можно удалить: его растения остаются без места (интервалы ухода пересчитываются
-- триггером plants_recompute_schedules — как при переносе растения).
alter table public.plants drop constraint plants_location_id_fkey;
alter table public.plants add constraint plants_location_id_fkey
  foreign key (location_id) references public.locations(id) on delete set null;
