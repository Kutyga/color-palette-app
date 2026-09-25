-- Новости на нескольких языках: фильтр по языку в ленте и новые источники.
-- Неработающая лента не ломает сбор: причина пишется в news_sources.last_error,
-- такой источник можно выключить через enabled = false.

drop function if exists public.news_feed(timestamptz, uuid, int, boolean);

create function public.news_feed(
  before_ts timestamptz default null,
  before_id uuid default null,
  lim int default 20,
  only_my_species boolean default false,
  langs text[] default null
)
returns table (
  id           uuid,
  url          text,
  title        text,
  summary      text,
  image_url    text,
  published_at timestamptz,
  source_name  text,
  species_ids  uuid[],
  language     text
)
language sql
stable
set search_path = public, extensions
as $$
  select a.id, a.url, a.title, a.summary, a.image_url, a.published_at, s.name, a.species_ids, a.language
    from public.news_articles a
    join public.news_sources s on s.id = a.source_id
   where (before_ts is null or (a.published_at, a.id) < (before_ts, before_id))
     and (langs is null or cardinality(langs) = 0 or a.language = any (langs))
     and (not only_my_species or a.species_ids && (
           select coalesce(array_agg(distinct species_id), '{}')
             from public.plants
            where owner_id = (select auth.uid()) and deleted_at is null and species_id is not null))
   order by a.published_at desc, a.id desc
   limit least(lim, 50);
$$;

grant execute on function public.news_feed(timestamptz, uuid, int, boolean, text[]) to anon, authenticated;

-- Языки, на которых есть новости, — для переключателя на сайте.
create or replace function public.news_languages()
returns table (language text, articles bigint)
language sql
stable
set search_path = public
as $$
  select a.language, count(*) from public.news_articles a group by a.language order by count(*) desc;
$$;

grant execute on function public.news_languages() to anon, authenticated;

insert into public.news_sources (name, feed_url, site_url, language, filter_keywords) values
  ('The Guardian: Gardens', 'https://www.theguardian.com/lifeandstyle/gardens/rss', 'https://www.theguardian.com/lifeandstyle/gardens', 'en', false),
  ('Epic Gardening', 'https://www.epicgardening.com/feed/', 'https://www.epicgardening.com', 'en', false),
  ('Gardenista', 'https://www.gardenista.com/feed/', 'https://www.gardenista.com', 'en', false),
  ('Garden Myths', 'https://www.gardenmyths.com/feed/', 'https://www.gardenmyths.com', 'en', false),
  ('ScienceDaily: Plants', 'https://www.sciencedaily.com/rss/plants_animals/plants.xml', 'https://www.sciencedaily.com', 'en', false),
  ('Hausgarten.net', 'https://www.hausgarten.net/feed/', 'https://www.hausgarten.net', 'de', false),
  ('Plantura Magazin', 'https://www.plantura.garden/feed', 'https://www.plantura.garden', 'de', false),
  ('Jardiner Malin', 'https://www.jardiner-malin.fr/feed', 'https://www.jardiner-malin.fr', 'fr', false),
  ('Jardinería On', 'https://www.jardineriaon.com/feed', 'https://www.jardineriaon.com', 'es', false),
  ('Floristics.info', 'https://www.floristics.info/ru/?format=feed&type=rss', 'https://www.floristics.info/ru/', 'ru', false),
  ('Садовникам.ру', 'https://sadovnikam.ru/feed', 'https://sadovnikam.ru', 'ru', false)
on conflict (feed_url) do nothing;
