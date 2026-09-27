-- Магазины: витрина, каталог с ценами (импорт из CSV/Excel), «Где купить» на странице вида,
-- уведомления «появилось в продаже / подешевело» по списку «Хочу». Магазин виден всем
-- только после ручной проверки администратором (значок ✓). Денег через приложение нет.

-- ---------------------------------------------------------------------------
-- Администраторы (назначаются вручную в базе)
-- ---------------------------------------------------------------------------

alter table public.profiles add column is_admin boolean not null default false;
-- Колонка не входит в разрешённые для обновления клиентом (column grants профиля).

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = (select auth.uid())), false);
$$;

-- ---------------------------------------------------------------------------
-- Магазины
-- ---------------------------------------------------------------------------

create table public.shops (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null unique default auth.uid() references public.profiles(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 2 and 80),
  description text not null default '' check (char_length(description) <= 1000),
  inn         text not null check (inn ~ '^[0-9]{10}([0-9]{2})?$'),
  city        text not null check (char_length(btrim(city)) between 2 and 60),
  address     text check (char_length(address) <= 200),
  hours       text check (char_length(hours) <= 100),
  phone       text check (char_length(phone) <= 30),
  website     text check (website ~ '^https?://' and char_length(website) <= 300),
  delivery    boolean not null default false,
  status      text not null default 'pending' check (status in ('pending', 'verified', 'rejected', 'suspended')),
  review_note text check (char_length(review_note) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  verified_at timestamptz
);

create index shops_city_idx on public.shops (lower(city)) where status = 'verified';
create index shops_status_idx on public.shops (status, created_at);

create trigger shops_updated_at before update on public.shops
  for each row execute function public.set_updated_at();

-- Новая заявка всегда «на проверке»; правка реквизитов проверенного магазина возвращает его на проверку.
create or replace function private.shops_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.review_note := null;
    new.verified_at := null;
  elsif (new.inn, new.name) is distinct from (old.inn, old.name) and old.status = 'verified'
        and new.status = old.status then
    new.status := 'pending';
    new.verified_at := null;
  end if;
  return new;
end;
$$;

create trigger shops_guard before insert or update on public.shops
  for each row execute function private.shops_guard();

alter table public.shops enable row level security;

create policy shops_read on public.shops for select to authenticated
  using (owner_id = (select auth.uid())
         or private.is_admin()
         or (status = 'verified' and private.can_view(owner_id, 'public')));
create policy shops_insert on public.shops for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy shops_update_own on public.shops for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

revoke update on public.shops from anon, authenticated;
grant update (name, description, inn, city, address, hours, phone, website, delivery) on public.shops to authenticated;
revoke all on public.shops from anon;

-- ---------------------------------------------------------------------------
-- Каталог
-- ---------------------------------------------------------------------------

create table public.shop_products (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  external_id text not null check (char_length(external_id) between 1 and 100),
  title       text not null check (char_length(btrim(title)) between 1 and 200),
  species_id  uuid references public.species(id) on delete set null,
  price_rub   int check (price_rub between 1 and 10000000),
  in_stock    boolean not null default true,
  pot_cm      numeric(5, 1) check (pot_cm > 0 and pot_cm < 1000),
  height_cm   int check (height_cm > 0 and height_cm < 10000),
  url         text check (url ~ '^https?://' and char_length(url) <= 500),
  image_url   text check (image_url ~ '^https://' and char_length(image_url) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (shop_id, external_id)
);

create index shop_products_species_idx on public.shop_products (species_id) where in_stock;
create index shop_products_shop_idx on public.shop_products (shop_id, title);

create trigger shop_products_updated_at before update on public.shop_products
  for each row execute function public.set_updated_at();

create or replace function private.owns_shop(p_shop uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.shops where id = p_shop and owner_id = (select auth.uid()));
$$;

create or replace function private.can_view_shop(p_shop uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shops s
     where s.id = p_shop
       and (s.owner_id = (select auth.uid())
            or private.is_admin()
            or (s.status = 'verified' and private.can_view(s.owner_id, 'public'))));
$$;

alter table public.shop_products enable row level security;

create policy shop_products_read on public.shop_products for select to authenticated
  using (private.can_view_shop(shop_id));
create policy shop_products_write on public.shop_products for all to authenticated
  using (private.owns_shop(shop_id)) with check (private.owns_shop(shop_id));
revoke all on public.shop_products from anon;

-- Не больше 5000 товаров в каталоге.
create or replace function private.shop_products_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.shop_products where shop_id = new.shop_id) >= 5000 then
    raise exception 'В каталоге не больше 5000 товаров' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger shop_products_limit before insert on public.shop_products
  for each row execute function private.shop_products_limit();

-- Импорт каталога одним вызовом: обновить по артикулу, при p_replace удалить отсутствующие в файле.
create or replace function public.shop_import_products(p_rows jsonb, p_replace boolean default false)
returns table (inserted int, updated int, deleted int)
language plpgsql
security invoker
set search_path = public
as $$
declare
  shop uuid := (select id from public.shops where owner_id = (select auth.uid()));
  n_ins int := 0;
  n_upd int := 0;
  n_del int := 0;
begin
  if shop is null then
    raise exception 'Сначала создайте магазин' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 5000 then
    raise exception 'Не больше 5000 строк за раз' using errcode = '22023';
  end if;
  with src as (
    select distinct on (r ->> 'external_id')
           r ->> 'external_id' as external_id,
           r ->> 'title' as title,
           nullif(r ->> 'species_id', '')::uuid as species_id,
           nullif(r ->> 'price_rub', '')::int as price_rub,
           coalesce((r ->> 'in_stock')::boolean, true) as in_stock,
           nullif(r ->> 'pot_cm', '')::numeric as pot_cm,
           nullif(r ->> 'height_cm', '')::int as height_cm,
           nullif(r ->> 'url', '') as url,
           nullif(r ->> 'image_url', '') as image_url
      from jsonb_array_elements(p_rows) r
  ),
  up as (
    insert into public.shop_products as p
           (shop_id, external_id, title, species_id, price_rub, in_stock, pot_cm, height_cm, url, image_url)
    select shop, external_id, title, species_id, price_rub, in_stock, pot_cm, height_cm, url, image_url from src
    on conflict (shop_id, external_id) do update
       set title = excluded.title, species_id = excluded.species_id, price_rub = excluded.price_rub,
           in_stock = excluded.in_stock, pot_cm = excluded.pot_cm, height_cm = excluded.height_cm,
           url = excluded.url, image_url = excluded.image_url
    returning (xmax = 0) as is_new
  )
  select count(*) filter (where is_new), count(*) filter (where not is_new) into n_ins, n_upd from up;
  if p_replace then
    delete from public.shop_products
     where shop_id = shop
       and external_id not in (select r ->> 'external_id' from jsonb_array_elements(p_rows) r);
    get diagnostics n_del = row_count;
  end if;
  return query select n_ins, n_upd, n_del;
end;
$$;

revoke execute on function public.shop_import_products(jsonb, boolean) from public, anon;
grant execute on function public.shop_import_products(jsonb, boolean) to authenticated;

-- «Где купить»: предложения проверенных магазинов по виду; сначала свой город, потом с доставкой.
create or replace function public.where_to_buy(p_species uuid, p_city text default null)
returns table (
  product_id uuid, title text, price_rub int, pot_cm numeric, height_cm int, url text, image_url text,
  shop_id uuid, shop_name text, shop_city text, shop_delivery boolean, same_city boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select p.id, p.title, p.price_rub, p.pot_cm, p.height_cm, p.url, p.image_url,
         s.id, s.name, s.city, s.delivery,
         p_city is not null and lower(btrim(s.city)) = lower(btrim(p_city))
    from public.shop_products p
    join public.shops s on s.id = p.shop_id and s.status = 'verified'
   where p.species_id = p_species and p.in_stock
     and (p_city is null or lower(btrim(s.city)) = lower(btrim(p_city)) or s.delivery)
   order by 12 desc, p.price_rub nulls last
   limit 30;
$$;

revoke execute on function public.where_to_buy(uuid, text) from public, anon;
grant execute on function public.where_to_buy(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Проверка магазинов администратором
-- ---------------------------------------------------------------------------

create or replace function private.review_shop(p_shop uuid, p_status text, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.shops;
begin
  if not private.is_admin() then
    raise exception 'Только для администратора' using errcode = '42501';
  end if;
  if p_status not in ('verified', 'rejected', 'suspended', 'pending') then
    raise exception 'Неизвестный статус' using errcode = '22023';
  end if;
  update public.shops
     set status = p_status,
         review_note = nullif(btrim(p_note), ''),
         verified_at = case when p_status = 'verified' then now() else null end
   where id = p_shop
  returning * into s;
  if s.id is null then
    raise exception 'Магазин не найден' using errcode = 'P0002';
  end if;
  perform private.enqueue_push(
    s.owner_id, 'community',
    case p_status when 'verified' then 'Магазин подтверждён ✓'
                  when 'rejected' then 'Заявка магазина отклонена'
                  when 'suspended' then 'Магазин скрыт'
                  else 'Магазин снова на проверке' end,
    coalesce(nullif(btrim(p_note), ''), s.name),
    '/shop/manage/', 'shop-' || s.id);
end;
$$;

create or replace function public.review_shop(p_shop uuid, p_status text, p_note text default null)
returns void
language sql
security invoker
set search_path = public
as $$
  select private.review_shop(p_shop, p_status, p_note);
$$;

revoke execute on function public.review_shop(uuid, text, text), private.review_shop(uuid, text, text) from public, anon;
grant execute on function public.review_shop(uuid, text, text), private.review_shop(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- «Хочу»: уведомления о появлении в продаже и снижении цены
-- ---------------------------------------------------------------------------

alter table public.profiles add column notify_wishlist boolean not null default true;
grant update (notify_wishlist) on public.profiles to authenticated;

create or replace function private.enqueue_push(p_user uuid, p_pref text, p_title text, p_body text, p_url text, p_tag text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into private.push_queue (user_id, title, body, url, tag)
  select p_user, left(p_title, 120), left(p_body, 240), p_url, p_tag
    from public.profiles p
   where p.id = p_user
     and case p_pref
           when 'care' then p.notify_care
           when 'messages' then p.notify_messages
           when 'wishlist' then p.notify_wishlist
           else p.notify_community
         end
     and exists (select 1 from public.push_subscriptions s where s.user_id = p_user);
$$;

create table private.wishlist_alert_log (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  species_id uuid not null references public.species(id) on delete cascade,
  day        date not null,
  primary key (user_id, species_id, day)
);
alter table private.wishlist_alert_log enable row level security;
revoke all on private.wishlist_alert_log from public, anon, authenticated;

-- Не чаще одного уведомления на вид в день; только от проверенных магазинов
-- своего города или с доставкой.
create or replace function private.shop_products_wishlist_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.shops;
  species_title text;
  r record;
begin
  if new.species_id is null or not new.in_stock then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.in_stock and old.species_id is not distinct from new.species_id
     and not (new.price_rub < old.price_rub) then
    return new;
  end if;
  select * into s from public.shops where id = new.shop_id and status = 'verified';
  if s.id is null then
    return new;
  end if;
  select coalesce(common_names -> 'ru' ->> 0, latin_name) into species_title
    from public.species where id = new.species_id;
  for r in
    with fresh as (
      insert into private.wishlist_alert_log (user_id, species_id, day)
      select w.user_id, new.species_id, current_date
        from public.wishlist_items w
        join public.profiles p on p.id = w.user_id
       where w.species_id = new.species_id
         and w.user_id <> s.owner_id
         and (s.delivery or lower(btrim(p.city)) = lower(btrim(s.city)))
      on conflict do nothing
      returning user_id
    )
    select user_id from fresh
  loop
    perform private.enqueue_push(
      r.user_id, 'wishlist',
      case when tg_op = 'UPDATE' and old.in_stock and new.price_rub < old.price_rub
           then 'Подешевело: ' || species_title
           else 'В продаже: ' || species_title end,
      s.name || ' · ' || coalesce(new.price_rub::text || ' ₽', 'цена по запросу')
        || case when s.delivery then ' · есть доставка' else ' · ' || s.city end,
      '/shop/?id=' || s.id, 'wish-' || new.species_id);
  end loop;
  return new;
end;
$$;

create trigger shop_products_wishlist_alert after insert or update of in_stock, price_rub, species_id on public.shop_products
  for each row execute function private.shop_products_wishlist_alert();

-- Список «Хочу» с фильтрами по виду нужен и для уведомлений.
create index if not exists wishlist_items_species_idx on public.wishlist_items (species_id);
