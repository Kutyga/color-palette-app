-- Люди: поиск садоводов, их профили, списки подписчиков и подписок, редактирование своего профиля.
--
-- Всё читается через RLS вызывающего (security invoker): число растений в карточке — это растения,
-- которые видит именно он (свои, публичные и «для подписчиков», если подписан). Заблокировавшие
-- пользователя профили скрывает политика profiles_read.

-- Имя по умолчанию: раньше display_name оставался пустым и везде показывался технический
-- username вида «maxim_1a2b3c4d». Теперь при регистрации имя берётся из email («Maxim»),
-- у существующих пустых профилей — из username без суффикса.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_name text;
begin
  base_name := lower(regexp_replace(
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1), 'user'),
    '[^a-zA-Z0-9_]', '', 'g'));
  if char_length(base_name) < 3 then
    base_name := 'user';
  end if;
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    left(base_name, 21) || '_' || substr(replace(new.id::text, '-', ''), 1, 8),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
             initcap(replace(left(base_name, 30), '_', ' ')))
  );
  return new;
end;
$$;

update public.profiles
   set display_name = initcap(replace(regexp_replace(username, '_[0-9a-f]{8}$', ''), '_', ' '))
 where display_name is null or btrim(display_name) = '';

alter table public.profiles drop constraint if exists profiles_display_name_len;
alter table public.profiles add constraint profiles_display_name_len
  check (display_name is null or char_length(btrim(display_name)) between 1 and 40);

-- Свой профиль меняют только эти поля (id и даты — нет).
revoke update on public.profiles from anon, authenticated;
grant update (username, display_name, bio, avatar_url, city, hemisphere, default_visibility,
              reminder_time, timezone) on public.profiles to authenticated;

-- Карточка садовода: имя, счётчики и отношения с текущим пользователем.
create or replace view public.profile_cards
with (security_invoker = true) as
select p.id,
       p.username,
       p.display_name,
       p.bio,
       (select count(*) from public.follows f where f.followee_id = p.id)::int as followers,
       (select count(*) from public.follows f where f.follower_id = p.id)::int as following,
       (select count(*) from public.plants pl
         where pl.owner_id = p.id and pl.deleted_at is null)::int              as plants,
       exists (select 1 from public.follows f
                where f.follower_id = (select auth.uid()) and f.followee_id = p.id) as is_following,
       exists (select 1 from public.follows f
                where f.follower_id = p.id and f.followee_id = (select auth.uid())) as follows_me,
       p.id = (select auth.uid())                                             as is_me
  from public.profiles p;

revoke all on public.profile_cards from anon;
grant select on public.profile_cards to authenticated;

-- Поиск по имени и username. Пустой запрос — самые популярные садоводы (кроме себя).
create or replace function public.search_people(q text default '', lim int default 20)
returns setof public.profile_cards
language sql
stable
security invoker
set search_path = public
as $$
  with term as (
    select btrim(coalesce(q, '')) as raw,
           '%' || replace(replace(replace(lower(btrim(coalesce(q, ''))), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
  )
  select c.*
    from public.profile_cards c, term t
   where (t.raw = '' and not c.is_me)
      or (t.raw <> '' and (lower(c.username) like t.pat or lower(coalesce(c.display_name, '')) like t.pat))
   order by (t.raw <> '' and (lower(c.username) like ltrim(t.pat, '%')
                              or lower(coalesce(c.display_name, '')) like ltrim(t.pat, '%'))) desc,
            c.followers desc,
            c.username
   limit greatest(1, least(coalesce(lim, 20), 50));
$$;

-- Подписчики и подписки садовода — новые сверху.
create or replace function public.people_followers(p_user uuid)
returns setof public.profile_cards
language sql
stable
security invoker
set search_path = public
as $$
  select c.* from public.follows f
    join public.profile_cards c on c.id = f.follower_id
   where f.followee_id = p_user
   order by f.created_at desc
   limit 500;
$$;

create or replace function public.people_following(p_user uuid)
returns setof public.profile_cards
language sql
stable
security invoker
set search_path = public
as $$
  select c.* from public.follows f
    join public.profile_cards c on c.id = f.followee_id
   where f.follower_id = p_user
   order by f.created_at desc
   limit 500;
$$;

revoke execute on function public.search_people(text, int) from public, anon;
revoke execute on function public.people_followers(uuid) from public, anon;
revoke execute on function public.people_following(uuid) from public, anon;
grant execute on function public.search_people(text, int) to authenticated;
grant execute on function public.people_followers(uuid) to authenticated;
grant execute on function public.people_following(uuid) to authenticated;
