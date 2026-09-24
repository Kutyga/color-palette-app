-- Новости о растениях: автоматический сбор из открытых RSS/Atom-лент
-- (Edge Function supabase/functions/news-ingest) + пользовательские посты (таблица posts).
-- Храним только заголовок, короткую выдержку, картинку и ссылку на первоисточник —
-- полный текст статей не копируем.

create table public.news_sources (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  feed_url        text unique not null,
  site_url        text,
  language        text not null default 'ru',
  -- Для общих научных лент берём только материалы с «растительными» ключевыми словами.
  filter_keywords boolean not null default false,
  enabled         boolean not null default true,
  last_fetched_at timestamptz,
  last_error      text
);

create table public.news_articles (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid not null references public.news_sources(id) on delete cascade,
  url          text unique not null,
  title        text not null,
  summary      text check (char_length(summary) <= 600),
  image_url    text,
  language     text not null default 'ru',
  published_at timestamptz not null default now(),
  species_ids  uuid[] not null default '{}',   -- виды из базы знаний, упомянутые в тексте
  fetched_at   timestamptz not null default now()
);

create index news_articles_published_idx on public.news_articles (published_at desc, id desc);
create index news_articles_species_idx on public.news_articles using gin (species_ids);

alter table public.news_sources  enable row level security;
alter table public.news_articles enable row level security;

create policy news_read on public.news_articles for select to anon, authenticated using (true);
create policy news_sources_read on public.news_sources for select to anon, authenticated using (enabled);

-- Какие виды из базы знаний упоминаются в тексте (латинское или народное название).
create or replace function public.match_species(p_text text)
returns uuid[]
language sql
stable
set search_path = public, extensions
as $$
  select coalesce(array_agg(distinct s.id), '{}')
    from public.species s
   cross join lateral (
     select s.latin_name as name
     union all
     select jsonb_array_elements_text(arr)
       from jsonb_each(s.common_names) as lang(key, arr)
   ) n
   where char_length(n.name) >= 5
     and lower(p_text) like '%' || lower(n.name) || '%';
$$;

-- Вставка статей из сборщика: дубликаты по URL пропускаются, виды проставляются сами.
create or replace function public.ingest_news(p_source uuid, p_items jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted int;
begin
  insert into public.news_articles (source_id, url, title, summary, image_url, language, published_at, species_ids)
  select p_source,
         item ->> 'url',
         left(item ->> 'title', 300),
         left(item ->> 'summary', 600),
         item ->> 'image_url',
         src.language,
         coalesce((item ->> 'published_at')::timestamptz, now()),
         public.match_species(concat_ws(' ', item ->> 'title', item ->> 'summary'))
    from jsonb_array_elements(p_items) as item
    join public.news_sources src on src.id = p_source
   where item ->> 'url' like 'http%'
     and coalesce(item ->> 'title', '') <> ''
  on conflict (url) do nothing;
  get diagnostics inserted = row_count;

  update public.news_sources set last_fetched_at = now(), last_error = null where id = p_source;
  return inserted;
end;
$$;

revoke execute on function public.ingest_news(uuid, jsonb) from public, anon, authenticated;

-- Лента новостей с курсором; p_species — только про растения из моей коллекции.
create or replace function public.news_feed(
  before_ts timestamptz default null,
  before_id uuid default null,
  lim int default 20,
  only_my_species boolean default false
)
returns table (
  id           uuid,
  url          text,
  title        text,
  summary      text,
  image_url    text,
  published_at timestamptz,
  source_name  text,
  species_ids  uuid[]
)
language sql
stable
set search_path = public, extensions
as $$
  select a.id, a.url, a.title, a.summary, a.image_url, a.published_at, s.name, a.species_ids
    from public.news_articles a
    join public.news_sources s on s.id = a.source_id
   where (before_ts is null or (a.published_at, a.id) < (before_ts, before_id))
     and (not only_my_species or a.species_ids && (
           select coalesce(array_agg(distinct species_id), '{}')
             from public.plants
            where owner_id = auth.uid() and deleted_at is null and species_id is not null))
   order by a.published_at desc, a.id desc
   limit least(lim, 50);
$$;
