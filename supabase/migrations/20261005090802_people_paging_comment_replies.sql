-- 1. Поиск садоводов постранично: search_people отдавал максимум 30 человек. Новая функция
--    search_people_page — с offset и сортировкой «популярные» (по подписчикам) или «новые»
--    (по дате регистрации), так видно всех. Старая остаётся для уже открытых вкладок со старым сайтом.
-- 2. Ответы на комментарии (одна ветка, как в Instagram) и «сердечки» на комментариях.

create or replace function public.search_people_page(q text default '', lim int default 30, off int default 0, sort text default 'popular')
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
    from public.profile_cards c
    join public.profiles p on p.id = c.id,
         term t
   where (t.raw = '' and c.is_me is not true)
      or (t.raw <> '' and (lower(c.username) like t.pat or lower(coalesce(c.display_name, '')) like t.pat))
   order by (t.raw <> '' and (lower(c.username) like ltrim(t.pat, '%')
                              or lower(coalesce(c.display_name, '')) like ltrim(t.pat, '%'))) desc,
            case when sort = 'new' then p.created_at end desc nulls last,
            c.followers desc,
            c.username
   limit greatest(1, least(coalesce(lim, 30), 50))
  offset greatest(0, coalesce(off, 0));
$$;

revoke execute on function public.search_people_page(text, int, int, text) from public, anon;
grant execute on function public.search_people_page(text, int, int, text) to authenticated;

-- Ответы: ветка всегда одна — ответ на ответ крепится к корневому комментарию той же записи.
create or replace function private.comment_thread_root()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent public.comments;
begin
  if new.parent_id is null then
    return new;
  end if;
  select * into parent from public.comments where id = new.parent_id;
  if parent.id is null or parent.post_id <> new.post_id then
    raise exception 'Комментарий, на который вы отвечаете, не найден' using errcode = '23503';
  end if;
  new.parent_id := coalesce(parent.parent_id, parent.id);
  return new;
end;
$$;

create trigger comments_thread_root before insert on public.comments
  for each row execute function private.comment_thread_root();

-- «Сердечки» на комментариях.
alter table public.comments add column like_count int not null default 0;

create table public.comment_likes (
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  comment_id uuid not null references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);

create index comment_likes_comment_idx on public.comment_likes (comment_id);

alter table public.comment_likes enable row level security;

create policy comment_likes_read on public.comment_likes for select to authenticated
  using (exists (select 1 from public.comments c
                  where c.id = comment_id and c.deleted_at is null and private.can_view_post(c.post_id)));
create policy comment_likes_insert on public.comment_likes for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.comments c
                           where c.id = comment_id and c.deleted_at is null and private.can_view_post(c.post_id)));
create policy comment_likes_delete on public.comment_likes for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.comment_likes from anon;
grant select, insert, delete on public.comment_likes to authenticated;

create or replace function private.comment_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.comments set like_count = like_count + 1 where id = new.comment_id;
  else
    update public.comments set like_count = greatest(0, like_count - 1) where id = old.comment_id;
  end if;
  return null;
end;
$$;

create trigger comment_likes_count after insert or delete on public.comment_likes
  for each row execute function private.comment_like_count();

-- Пуш: ответ на комментарий → автору комментария; автору записи — как раньше
-- (если он не тот же человек, что получил уведомление об ответе).
create or replace function private.push_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.posts;
  parent_author uuid;
  link text;
begin
  select * into p from public.posts where id = new.post_id and deleted_at is null;
  if p.id is null then
    return new;
  end if;
  link := case when p.kind = 'question' then '/feed/question/?id=' || p.id
               when p.plant_id is not null then '/feed/plant/?id=' || p.plant_id
               else '/feed/' end;
  if new.parent_id is not null then
    select author_id into parent_author from public.comments where id = new.parent_id;
    if parent_author is not null and parent_author <> new.author_id then
      perform private.enqueue_push(
        parent_author,
        'community',
        'Ответ на ваш комментарий',
        private.display_name(new.author_id) || ': ' || new.text,
        link,
        'post-' || p.id);
    end if;
  end if;
  if p.author_id = new.author_id or p.author_id = parent_author then
    return new;
  end if;
  perform private.enqueue_push(
    p.author_id,
    'community',
    case when p.kind = 'question' then 'Новый ответ на ваш вопрос' else 'Новый комментарий к записи' end,
    private.display_name(new.author_id) || ': ' || new.text,
    link,
    'post-' || p.id);
  return new;
end;
$$;
