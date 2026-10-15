-- Группу можно показать в профиле: гости видят её название и те растения из неё, которые им и так разрешено видеть.
alter table public.plant_groups add column is_public boolean not null default false;

create policy plant_groups_public_read on public.plant_groups for select to authenticated
  using (is_public);

create policy plant_group_members_public_read on public.plant_group_members for select to authenticated
  using (
    exists (select 1 from public.plant_groups g where g.id = group_id and g.is_public)
    and private.can_view_plant(plant_id));
