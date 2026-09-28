-- Посты команды «Подоконника» (профили администраторов): метка «Совет» и показ всем в «Дневниках».
-- Новички ещё ни на кого не подписаны — без этого их лента «Подписки» пуста.

alter table public.posts drop constraint posts_event_check;
alter table public.posts add constraint posts_event_check
  check (event in ('new_leaf', 'bloom', 'repot', 'cutting', 'rescue', 'progress', 'tip'));

create or replace function public.feed_diaries(
  scope text default 'following',
  before_ts timestamptz default null,
  before_id uuid default null,
  lim int default 20
)
returns setof public.posts
language sql
stable
set search_path = public, extensions
as $$
  select p.*
    from public.posts p
   where p.deleted_at is null
     and p.kind in ('milestone', 'photo')
     and case when scope = 'all'
              then p.visibility = 'public' or p.author_id = (select auth.uid())
              else p.author_id = (select auth.uid())
                   or p.author_id in (select followee_id from public.follows
                                       where follower_id = (select auth.uid()))
                   or (p.visibility = 'public'
                       and p.author_id in (select id from public.profiles where is_admin))
         end
     and (before_ts is null or (p.created_at, p.id) < (before_ts, before_id))
   order by p.created_at desc, p.id desc
   limit least(lim, 50);
$$;
