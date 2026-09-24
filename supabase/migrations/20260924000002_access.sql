-- Права доступа: вспомогательные функции и Row Level Security.
-- Функции-помощники — security definer, чтобы политики не вызывали друг друга рекурсивно.

-- ---------------------------------------------------------------------------
-- Помощники
-- ---------------------------------------------------------------------------

create or replace function public.is_blocked_by(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
     where blocker_id = p_owner and blocked_id = auth.uid());
$$;

-- Может ли текущий пользователь видеть контент владельца с данной видимостью.
create or replace function public.can_view(p_owner uuid, p_visibility text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_owner = auth.uid()
      or (
        auth.uid() is not null
        and not public.is_blocked_by(p_owner)
        and (
          p_visibility = 'public'
          or (p_visibility = 'followers' and exists (
                select 1 from public.follows
                 where follower_id = auth.uid() and followee_id = p_owner))
        )
      );
$$;

-- Помощник по уходу (со-опекун) с действующим доступом.
create or replace function public.is_caretaker(p_plant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.plant_caretakers
     where plant_id = p_plant
       and user_id = auth.uid()
       and (until is null or until > now()));
$$;

create or replace function public.can_view_plant(p_plant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.plants p
     where p.id = p_plant
       and (public.can_view(p.owner_id, p.visibility) or public.is_caretaker(p.id))
       and (p.deleted_at is null or p.owner_id = auth.uid()));
$$;

create or replace function public.can_care_plant(p_plant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.plants p
     where p.id = p_plant
       and (p.owner_id = auth.uid() or public.is_caretaker(p.id)));
$$;

create or replace function public.owns_plant(p_plant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.plants where id = p_plant and owner_id = auth.uid());
$$;

create or replace function public.can_view_post(p_post uuid)
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
       and public.can_view(author_id, visibility));
$$;

-- ---------------------------------------------------------------------------
-- Включаем RLS везде
-- ---------------------------------------------------------------------------

alter table public.profiles           enable row level security;
alter table public.families           enable row level security;
alter table public.genera             enable row level security;
alter table public.species            enable row level security;
alter table public.care_profiles      enable row level security;
alter table public.diseases           enable row level security;
alter table public.species_diseases   enable row level security;
alter table public.kb_articles        enable row level security;
alter table public.kb_article_species enable row level security;
alter table public.locations          enable row level security;
alter table public.plants             enable row level security;
alter table public.plant_photos       enable row level security;
alter table public.plant_caretakers   enable row level security;
alter table public.care_schedules     enable row level security;
alter table public.care_events        enable row level security;
alter table public.follows            enable row level security;
alter table public.blocks             enable row level security;
alter table public.posts              enable row level security;
alter table public.likes              enable row level security;
alter table public.comments           enable row level security;
alter table public.reports            enable row level security;
alter table public.wishlist_items     enable row level security;
alter table public.devices            enable row level security;

-- ---------------------------------------------------------------------------
-- База знаний: читают все (включая гостей), пишет только service_role (админка).
-- ---------------------------------------------------------------------------

create policy kb_read on public.families           for select to anon, authenticated using (true);
create policy kb_read on public.genera             for select to anon, authenticated using (true);
create policy kb_read on public.species            for select to anon, authenticated using (true);
create policy kb_read on public.care_profiles      for select to anon, authenticated using (true);
create policy kb_read on public.diseases           for select to anon, authenticated using (true);
create policy kb_read on public.species_diseases   for select to anon, authenticated using (true);
create policy kb_read on public.kb_article_species for select to anon, authenticated using (true);
create policy kb_read on public.kb_articles        for select to anon, authenticated
  using (published_at is not null and published_at <= now());

-- ---------------------------------------------------------------------------
-- Профили
-- ---------------------------------------------------------------------------

create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or not public.is_blocked_by(id));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Коллекция
-- ---------------------------------------------------------------------------

create policy locations_own on public.locations for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy plants_own on public.plants for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy plants_read_shared on public.plants for select to authenticated
  using (public.can_view_plant(id));

create policy plant_photos_read on public.plant_photos for select to authenticated
  using (public.can_view_plant(plant_id));
create policy plant_photos_insert on public.plant_photos for insert to authenticated
  with check (uploaded_by = auth.uid() and public.can_care_plant(plant_id));
create policy plant_photos_delete on public.plant_photos for delete to authenticated
  using (uploaded_by = auth.uid() or public.owns_plant(plant_id));

create policy caretakers_read on public.plant_caretakers for select to authenticated
  using (user_id = auth.uid() or public.owns_plant(plant_id));
create policy caretakers_manage on public.plant_caretakers for all to authenticated
  using (public.owns_plant(plant_id)) with check (public.owns_plant(plant_id));
-- Помощник может сам отказаться от ухода.
create policy caretakers_leave on public.plant_caretakers for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Уход
-- ---------------------------------------------------------------------------

create policy schedules_read on public.care_schedules for select to authenticated
  using (public.can_view_plant(plant_id));
create policy schedules_write on public.care_schedules for all to authenticated
  using (public.can_care_plant(plant_id)) with check (public.can_care_plant(plant_id));

create policy events_read on public.care_events for select to authenticated
  using (public.can_view_plant(plant_id));
create policy events_insert on public.care_events for insert to authenticated
  with check (performed_by = auth.uid() and public.can_care_plant(plant_id));
-- Журнал только на добавление; удалить ошибочную запись может автор.
create policy events_delete_own on public.care_events for delete to authenticated
  using (performed_by = auth.uid());

-- ---------------------------------------------------------------------------
-- Социальная часть
-- ---------------------------------------------------------------------------

create policy follows_read on public.follows for select to authenticated using (true);
create policy follows_insert on public.follows for insert to authenticated
  with check (follower_id = auth.uid() and not public.is_blocked_by(followee_id));
create policy follows_delete on public.follows for delete to authenticated
  using (follower_id = auth.uid() or followee_id = auth.uid());  -- можно удалить подписчика

create policy blocks_own on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create policy posts_read on public.posts for select to authenticated
  using (deleted_at is null and public.can_view(author_id, visibility));
create policy posts_own on public.posts for all to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy likes_read on public.likes for select to authenticated
  using (public.can_view_post(post_id));
create policy likes_insert on public.likes for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_post(post_id));
create policy likes_delete on public.likes for delete to authenticated
  using (user_id = auth.uid());

create policy comments_read on public.comments for select to authenticated
  using (deleted_at is null and public.can_view_post(post_id));
create policy comments_insert on public.comments for insert to authenticated
  with check (author_id = auth.uid() and public.can_view_post(post_id));
create policy comments_update_own on public.comments for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy reports_own on public.reports for all to authenticated
  using (reporter_id = auth.uid()) with check (reporter_id = auth.uid());

create policy wishlist_own on public.wishlist_items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy wishlist_read_followers on public.wishlist_items for select to authenticated
  using (public.can_view(user_id, 'followers'));

create policy devices_own on public.devices for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Денормализованные счётчики и служебные поля меняют только триггеры.
-- Колоночный revoke не отменяет табличный grant, поэтому отзываем UPDATE целиком
-- и выдаём обратно только на разрешённые колонки.
revoke update on public.posts from anon, authenticated;
grant update (plant_id, kind, text, photo_paths, visibility, deleted_at)
  on public.posts to authenticated;

revoke update on public.care_schedules from anon, authenticated;
grant update (interval_days, auto_adjust, enabled) on public.care_schedules to authenticated;

revoke update on public.reports from anon, authenticated;
