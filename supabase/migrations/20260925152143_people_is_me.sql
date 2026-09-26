-- Уточнение к «людям»: у гостя (без auth.uid) поле is_me было NULL, из-за чего рекомендации
-- в search_people('') отфильтровывались целиком. Теперь is_me всегда true/false.

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
       coalesce(p.id = (select auth.uid()), false)                            as is_me
  from public.profiles p;

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
   where (t.raw = '' and c.is_me is not true)
      or (t.raw <> '' and (lower(c.username) like t.pat or lower(coalesce(c.display_name, '')) like t.pat))
   order by (t.raw <> '' and (lower(c.username) like ltrim(t.pat, '%')
                              or lower(coalesce(c.display_name, '')) like ltrim(t.pat, '%'))) desc,
            c.followers desc,
            c.username
   limit greatest(1, least(coalesce(lim, 20), 50));
$$;

