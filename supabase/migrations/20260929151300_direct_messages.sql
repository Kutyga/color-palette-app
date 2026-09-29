-- Личные сообщения между садоводами (не только по объявлениям): кнопка «Написать» в профиле.
-- Это те же conversations/messages, что у барахолки, с пометкой direct: у пары садоводов —
-- один личный чат. Блокировки, лимит сообщений и push-уведомления работают как в барахолке.

alter table public.conversations add column direct boolean not null default false;

-- Один личный чат на пару, кто бы из двоих его ни начал.
create unique index conversations_direct_pair_key
  on public.conversations (least(buyer_id, seller_id), greatest(buyer_id, seller_id))
  where direct;

-- Начать (или открыть уже начатый) личный чат с садоводом.
create or replace function private.start_direct(p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  conv uuid;
begin
  if me is null then
    raise exception 'Нужно войти' using errcode = '42501';
  end if;
  if p_user = me then
    raise exception 'Нельзя написать самому себе' using errcode = '23514';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'Садовод не найден' using errcode = 'P0002';
  end if;
  select id into conv from public.conversations
   where direct and least(buyer_id, seller_id) = least(me, p_user)
     and greatest(buyer_id, seller_id) = greatest(me, p_user);
  if conv is not null then
    return conv;
  end if;
  if exists (select 1 from public.blocks
              where (blocker_id = me and blocked_id = p_user)
                 or (blocker_id = p_user and blocked_id = me)) then
    raise exception 'Написать этому садоводу нельзя' using errcode = '42501';
  end if;
  -- Общий с барахолкой лимит: не больше 30 новых переписок в сутки.
  if (select count(*) from public.conversations
       where buyer_id = me and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Сегодня уже начато много переписок — продолжите завтра' using errcode = '54000';
  end if;
  insert into public.conversations (direct, buyer_id, seller_id)
  values (true, me, p_user)
  on conflict do nothing
  returning id into conv;
  if conv is null then
    -- Собеседник начал чат одновременно с нами — берём его.
    select id into conv from public.conversations
     where direct and least(buyer_id, seller_id) = least(me, p_user)
       and greatest(buyer_id, seller_id) = greatest(me, p_user);
  end if;
  return conv;
end;
$$;

create or replace function public.start_direct(p_user uuid)
returns uuid
language sql
security invoker
set search_path = public
as $$
  select private.start_direct(p_user);
$$;

revoke execute on function public.start_direct(uuid), private.start_direct(uuid) from public, anon;
grant execute on function public.start_direct(uuid), private.start_direct(uuid) to authenticated;

-- Список чатов: добавилась пометка direct (у личного чата нет объявления и розыгрыша).
drop function public.my_conversations();
create function public.my_conversations()
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
  blocked boolean,
  direct boolean
)
language sql
stable
set search_path = public
as $$
  select c.id,
         c.listing_id,
         coalesce(l.title, '🎉 ' || ct.title),
         l.kind,
         l.status,
         coalesce(l.photo_paths[1], ct.photo_path),
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
         not private.can_message(c.id),
         c.direct
    from public.conversations c
    left join public.profiles o
      on o.id = case when c.seller_id = (select auth.uid()) then c.buyer_id else c.seller_id end
    left join public.listings l on l.id = c.listing_id
    left join public.contests ct on ct.id = c.contest_id
   where (select auth.uid()) in (c.buyer_id, c.seller_id)
   order by coalesce(c.last_message_at, c.created_at) desc
   limit 100;
$$;

revoke execute on function public.my_conversations() from public, anon;
grant execute on function public.my_conversations() to authenticated;
