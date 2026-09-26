-- Лента «Дневники + Помощь» вместо формата TikTok/Instagram.
-- Дневник (kind = 'milestone', старые 'photo' — тоже дневник): события из жизни растения.
-- Помощь (kind = 'question'): вопрос с фото, ответы — комментарии, автор отмечает лучший ответ.

alter table public.posts
  add column event text
    check (event in ('new_leaf', 'bloom', 'repot', 'cutting', 'rescue', 'progress')),
  add column species_id uuid references public.species(id) on delete set null,
  add column solved_comment_id uuid references public.comments(id) on delete set null;

alter table public.posts
  add constraint posts_solved_only_questions check (solved_comment_id is null or kind = 'question');

create index posts_species_idx on public.posts (species_id) where deleted_at is null;
create index posts_solved_comment_idx on public.posts (solved_comment_id);
create index posts_kind_idx on public.posts (kind, created_at desc, id desc) where deleted_at is null;

-- Вид берём из своего растения; лучшим ответом можно отметить только живой ответ на этот вопрос.
create or replace function private.posts_check_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.plant_id is not null
     and (tg_op = 'INSERT' or new.plant_id is distinct from old.plant_id) then
    new.species_id := coalesce(
      (select species_id from public.plants where id = new.plant_id and owner_id = new.author_id),
      new.species_id);
  end if;
  if new.solved_comment_id is not null
     and (tg_op = 'INSERT' or new.solved_comment_id is distinct from old.solved_comment_id)
     and not exists (select 1 from public.comments c
                      where c.id = new.solved_comment_id
                        and c.post_id = new.id
                        and c.deleted_at is null) then
    raise exception 'Лучшим ответом можно отметить только ответ на этот вопрос'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger posts_check_fields
  before insert or update of plant_id, solved_comment_id on public.posts
  for each row execute function private.posts_check_fields();

grant update (event, species_id, solved_comment_id) on public.posts to authenticated;

-- «Дневники»: записи тех, на кого подписан (и свои), или все публичные.
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
         end
     and (before_ts is null or (p.created_at, p.id) < (before_ts, before_id))
   order by p.created_at desc, p.id desc
   limit least(lim, 50);
$$;

-- «Помощь»: open — без лучшего ответа (сначала совсем без ответов), my_species — про виды,
-- которые растут у меня, mine — мои вопросы, all — все.
create or replace function public.help_questions(filter text default 'open', lim int default 30)
returns setof public.posts
language sql
stable
set search_path = public, extensions
as $$
  select p.*
    from public.posts p
   where p.deleted_at is null
     and p.kind = 'question'
     and case filter
           when 'open' then p.solved_comment_id is null
           when 'my_species' then p.species_id in (select species_id from public.plants
                                                    where owner_id = (select auth.uid())
                                                      and deleted_at is null)
           when 'mine' then p.author_id = (select auth.uid())
           else true
         end
   order by case when filter = 'open' then (p.comment_count > 0)::int else 0 end,
            p.created_at desc, p.id desc
   limit least(lim, 50);
$$;

revoke execute on function
  public.feed_diaries(text, timestamptz, uuid, int),
  public.help_questions(text, int)
from public, anon;

grant execute on function
  public.feed_diaries(text, timestamptz, uuid, int),
  public.help_questions(text, int)
to authenticated;
