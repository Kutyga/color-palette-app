-- «Барахолка» и личные сообщения.
-- Объявления: продаю / отдам даром / обмен / ищу. Денег через приложение нет — люди договариваются
-- в чате. В объявлении только город, без адреса. Переписку видят только двое её участников.

-- ---------------------------------------------------------------------------
-- Объявления
-- ---------------------------------------------------------------------------

create table public.listings (
  id          uuid primary key default gen_random_uuid(),
  seller_id   uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('sell', 'free', 'swap', 'wanted')),
  species_id  uuid references public.species(id) on delete set null,
  title       text not null check (char_length(btrim(title)) between 3 and 80),
  description text not null default '' check (char_length(description) <= 2000),
  price_rub   int check (price_rub between 1 and 1000000),
  swap_for    text check (char_length(swap_for) <= 200),
  city        text not null check (char_length(btrim(city)) between 2 and 60),
  delivery    boolean not null default false,
  photo_paths text[] not null default '{}',
  status      text not null default 'active' check (status in ('active', 'reserved', 'closed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  -- Цена — только у «Продаю» и там обязательна; фото обязательно всем, кроме «Ищу».
  constraint listings_price check ((kind = 'sell') = (price_rub is not null)),
  constraint listings_photo check (kind = 'wanted' or cardinality(photo_paths) between 1 and 5)
);

create index listings_feed_idx on public.listings (created_at desc, id desc)
  where deleted_at is null and status <> 'closed';
create index listings_seller_idx on public.listings (seller_id, created_at desc);
create index listings_species_idx on public.listings (species_id);
create index listings_city_idx on public.listings (lower(city)) where deleted_at is null;

create trigger listings_updated_at before update on public.listings
  for each row execute function public.set_updated_at();

-- Не больше 20 открытых объявлений на человека — против спама.
create or replace function private.listings_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.listings
       where seller_id = new.seller_id and deleted_at is null and status <> 'closed') >= 20 then
    raise exception 'Не больше 20 открытых объявлений — закройте проданные' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger listings_limit before insert on public.listings
  for each row execute function private.listings_limit();

alter table public.listings enable row level security;

create policy listings_read on public.listings for select to authenticated
  using (seller_id = (select auth.uid())
         or (deleted_at is null and private.can_view(seller_id, 'public')));
create policy listings_insert on public.listings for insert to authenticated
  with check (seller_id = (select auth.uid()));
create policy listings_update on public.listings for update to authenticated
  using (seller_id = (select auth.uid())) with check (seller_id = (select auth.uid()));

revoke update on public.listings from anon, authenticated;
grant update (kind, species_id, title, description, price_rub, swap_for, city, delivery,
              photo_paths, status, deleted_at)
  on public.listings to authenticated;
revoke all on public.listings from anon;

-- Фото объявлений: listing-photos/{seller_id}/{listing_id}/{n}.jpg
insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', false)
on conflict (id) do nothing;

create policy listing_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'listing-photos');
create policy listing_photos_write on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy listing_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- Переписка: один чат на пару «покупатель — объявление»
-- ---------------------------------------------------------------------------

create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid references public.listings(id) on delete set null,
  buyer_id        uuid not null references public.profiles(id) on delete cascade,
  seller_id       uuid not null references public.profiles(id) on delete cascade,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz,
  last_message    text,
  last_sender_id  uuid references public.profiles(id) on delete set null,
  buyer_read_at   timestamptz,
  seller_read_at  timestamptz,
  check (buyer_id <> seller_id),
  unique (listing_id, buyer_id)
);

create index conversations_buyer_idx on public.conversations (buyer_id, last_message_at desc);
create index conversations_seller_idx on public.conversations (seller_id, last_message_at desc);
create index conversations_last_sender_idx on public.conversations (last_sender_id);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body            text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at      timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_sender_idx on public.messages (sender_id, created_at desc);

create or replace function private.is_participant(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversations
     where id = p_conversation
       and (select auth.uid()) in (buyer_id, seller_id));
$$;

-- Писать можно, пока никто из двоих не заблокировал другого.
create or replace function private.can_message(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversations c
     where c.id = p_conversation
       and (select auth.uid()) in (c.buyer_id, c.seller_id)
       and not exists (
         select 1 from public.blocks b
          where (b.blocker_id = c.buyer_id and b.blocked_id = c.seller_id)
             or (b.blocker_id = c.seller_id and b.blocked_id = c.buyer_id)));
$$;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Чаты создаёт только start_conversation, меняют — триггер и mark_conversation_read.
create policy conversations_read on public.conversations for select to authenticated
  using ((select auth.uid()) in (buyer_id, seller_id));
revoke insert, update, delete on public.conversations from anon, authenticated;
revoke all on public.conversations from anon;

create policy messages_read on public.messages for select to authenticated
  using (private.is_participant(conversation_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and private.can_message(conversation_id));
revoke update, delete on public.messages from anon, authenticated;
revoke all on public.messages from anon;

-- Не больше 20 сообщений в минуту от одного человека; последнее сообщение — в карточку чата.
create or replace function private.messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.messages
       where sender_id = new.sender_id and created_at > now() - interval '1 minute') > 20 then
    raise exception 'Слишком много сообщений подряд — подождите минуту' using errcode = '54000';
  end if;
  update public.conversations
     set last_message_at = new.created_at,
         last_message    = left(new.body, 140),
         last_sender_id  = new.sender_id,
         buyer_read_at   = case when new.sender_id = buyer_id then new.created_at else buyer_read_at end,
         seller_read_at  = case when new.sender_id = seller_id then new.created_at else seller_read_at end
   where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_after_insert after insert on public.messages
  for each row execute function private.messages_after_insert();

-- Начать (или открыть уже начатый) чат по объявлению.
create or replace function public.start_conversation(p_listing uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  l public.listings;
  conv uuid;
begin
  if me is null then
    raise exception 'Нужно войти' using errcode = '42501';
  end if;
  select * into l from public.listings where id = p_listing and deleted_at is null;
  if l.id is null or not private.can_view(l.seller_id, 'public') then
    raise exception 'Объявление не найдено' using errcode = 'P0002';
  end if;
  if l.seller_id = me then
    raise exception 'Это ваше объявление' using errcode = '23514';
  end if;
  select id into conv from public.conversations where listing_id = p_listing and buyer_id = me;
  if conv is not null then
    return conv;
  end if;
  if l.status = 'closed' then
    raise exception 'Объявление закрыто' using errcode = '23514';
  end if;
  if exists (select 1 from public.blocks
              where (blocker_id = me and blocked_id = l.seller_id)
                 or (blocker_id = l.seller_id and blocked_id = me)) then
    raise exception 'Написать этому садоводу нельзя' using errcode = '42501';
  end if;
  if (select count(*) from public.conversations
       where buyer_id = me and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Сегодня уже начато много переписок — продолжите завтра' using errcode = '54000';
  end if;
  insert into public.conversations (listing_id, buyer_id, seller_id)
  values (p_listing, me, l.seller_id)
  returning id into conv;
  return conv;
end;
$$;

-- Отметить чат прочитанным (только свою сторону).
create or replace function public.mark_conversation_read(p_conversation uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.conversations
     set buyer_read_at  = case when buyer_id  = (select auth.uid()) then now() else buyer_read_at end,
         seller_read_at = case when seller_id = (select auth.uid()) then now() else seller_read_at end
   where id = p_conversation
     and (select auth.uid()) in (buyer_id, seller_id);
$$;

-- Мои чаты: собеседник, объявление, последнее сообщение, есть ли непрочитанное.
create or replace function public.my_conversations()
returns table (
  id uuid,
  listing_id uuid,
  listing_title text,
  listing_kind text,
  listing_status text,
  listing_photo text,
  i_am_seller boolean,
  other_id uuid,
  other_username text,
  other_display_name text,
  last_message text,
  last_message_at timestamptz,
  last_from_me boolean,
  unread boolean,
  blocked boolean
)
language sql
stable
set search_path = public
as $$
  select c.id,
         c.listing_id,
         l.title,
         l.kind,
         l.status,
         l.photo_paths[1],
         c.seller_id = (select auth.uid()),
         case when c.seller_id = (select auth.uid()) then c.buyer_id else c.seller_id end,
         coalesce(o.username, 'sadovod'),
         coalesce(nullif(btrim(o.display_name), ''), o.username, 'Садовод'),
         c.last_message,
         coalesce(c.last_message_at, c.created_at),
         c.last_sender_id = (select auth.uid()),
         c.last_message_at is not null
           and c.last_sender_id is distinct from (select auth.uid())
           and c.last_message_at > coalesce(
                 case when c.seller_id = (select auth.uid()) then c.seller_read_at else c.buyer_read_at end,
                 '-infinity'),
         not private.can_message(c.id)
    from public.conversations c
    left join public.profiles o
      on o.id = case when c.seller_id = (select auth.uid()) then c.buyer_id else c.seller_id end
    left join public.listings l on l.id = c.listing_id
   where (select auth.uid()) in (c.buyer_id, c.seller_id)
   order by coalesce(c.last_message_at, c.created_at) desc
   limit 100;
$$;

revoke execute on function
  public.start_conversation(uuid),
  public.mark_conversation_read(uuid),
  public.my_conversations()
from public, anon;
grant execute on function
  public.start_conversation(uuid),
  public.mark_conversation_read(uuid),
  public.my_conversations()
to authenticated;

-- Новые сообщения приходят в открытый чат сразу (Realtime учитывает RLS).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

-- Жалобы теперь и на объявления, и на сообщения.
alter table public.reports drop constraint reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('profile', 'plant', 'post', 'comment', 'listing', 'message'));
