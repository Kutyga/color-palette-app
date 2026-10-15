-- Запросы садоводов: запись дневника сразу о нескольких растениях, свои группы в коллекции,
-- лента «Активность» (кто прокомментировал, ответил, отметил или подписался).

-- 1. Запись дневника о нескольких растениях: posts.plant_id — главное, остальные — здесь.
create table public.post_plants (
  post_id uuid not null references public.posts(id) on delete cascade,
  plant_id uuid not null references public.plants(id) on delete cascade,
  primary key (post_id, plant_id)
);
create index post_plants_plant_idx on public.post_plants(plant_id);
alter table public.post_plants enable row level security;
-- Видно тем, кто видит саму запись (RLS posts действует и в подзапросе).
create policy post_plants_read on public.post_plants for select
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy post_plants_insert on public.post_plants for insert
  with check (
    exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
    and exists (select 1 from public.plants pl where pl.id = plant_id and pl.owner_id = (select auth.uid())));
create policy post_plants_delete on public.post_plants for delete
  using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())));

-- 2. Свои группы растений («Бонсаи», «Кактусы на кухне») — видны только владельцу.
create table public.plant_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);
create unique index plant_groups_owner_name_idx on public.plant_groups(owner_id, lower(btrim(name)));
alter table public.plant_groups enable row level security;
create policy plant_groups_own on public.plant_groups for all
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create table public.plant_group_members (
  group_id uuid not null references public.plant_groups(id) on delete cascade,
  plant_id uuid not null references public.plants(id) on delete cascade,
  primary key (group_id, plant_id)
);
create index plant_group_members_plant_idx on public.plant_group_members(plant_id);
alter table public.plant_group_members enable row level security;
create policy plant_group_members_read on public.plant_group_members for select
  using (exists (select 1 from public.plant_groups g where g.id = group_id and g.owner_id = (select auth.uid())));
create policy plant_group_members_insert on public.plant_group_members for insert
  with check (
    exists (select 1 from public.plant_groups g where g.id = group_id and g.owner_id = (select auth.uid()))
    and exists (select 1 from public.plants pl where pl.id = plant_id and pl.owner_id = (select auth.uid())));
create policy plant_group_members_delete on public.plant_group_members for delete
  using (exists (select 1 from public.plant_groups g where g.id = group_id and g.owner_id = (select auth.uid())));

-- 3. «Активность»: события вокруг меня, новые сверху; непрочитанные — новее activity_seen_at.
alter table public.profiles add column activity_seen_at timestamptz not null default now();

create function public.my_activity(lim integer default 50)
returns table (
  id text, kind text, created_at timestamptz,
  actor_username text, actor_display_name text,
  post_id uuid, post_kind text, post_plant_id uuid, plant_name text, text text, unread boolean)
language sql stable security definer
set search_path = public
as $$
  with me as (
    select p.id uid, p.activity_seen_at seen from public.profiles p where p.id = (select auth.uid())
  ),
  ev as (
    -- комментарии к моим записям и ответы на мои комментарии
    select 'c' || c.id::text id,
           case when pc.author_id = me.uid then 'reply' else 'comment' end kind,
           c.created_at, c.author_id actor, p.id post_id, c.text
      from public.comments c
      join public.posts p on p.id = c.post_id
      left join public.comments pc on pc.id = c.parent_id
      cross join me
     where c.deleted_at is null and p.deleted_at is null and c.author_id <> me.uid
       and (p.author_id = me.uid or pc.author_id = me.uid)
    union all
    select 'l' || l.post_id::text || l.user_id::text, 'like', l.created_at, l.user_id, p.id, null
      from public.likes l join public.posts p on p.id = l.post_id cross join me
     where p.author_id = me.uid and p.deleted_at is null and l.user_id <> me.uid
    union all
    select 'f' || f.follower_id::text, 'follow', f.created_at, f.follower_id, null, null
      from public.follows f cross join me
     where f.followee_id = me.uid
  )
  select ev.id, ev.kind, ev.created_at, pr.username, pr.display_name,
         ev.post_id, p.kind, p.plant_id, pl.nickname, left(ev.text, 200), ev.created_at > me.seen
    from ev
    cross join me
    left join public.profiles pr on pr.id = ev.actor
    left join public.posts p on p.id = ev.post_id
    left join public.plants pl on pl.id = p.plant_id
   order by ev.created_at desc
   limit least(greatest(lim, 1), 100);
$$;

create function public.activity_unread_count()
returns integer
language sql stable security definer
set search_path = public
as $$
  select count(*)::int from public.my_activity(100) where unread;
$$;

create function public.mark_activity_seen()
returns void
language sql security definer
set search_path = public
as $$
  update public.profiles set activity_seen_at = now() where id = (select auth.uid());
$$;

revoke execute on function public.my_activity(integer), public.activity_unread_count(), public.mark_activity_seen() from public, anon;
grant execute on function public.my_activity(integer), public.activity_unread_count(), public.mark_activity_seen() to authenticated;
