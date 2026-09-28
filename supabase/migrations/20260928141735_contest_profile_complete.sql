-- Розыгрыши: с заполненным профилем или после первой публикации участвовать можно сразу.
-- Раньше новый аккаунт ждал 7 дней; теперь ожидание нужно, только если нет ни того, ни другого.
-- Правило совпадает с web/src/lib/domain/contest.ts (profileComplete).

create or replace function private.profile_complete(p public.profiles)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select char_length(btrim(coalesce(p.display_name, ''))) >= 2
     and btrim(coalesce(p.city, '')) <> ''
     and btrim(coalesce(p.bio, '')) <> '';
$$;

revoke execute on function private.profile_complete(public.profiles) from public, anon;
grant execute on function private.profile_complete(public.profiles) to authenticated;

create or replace function private.join_contest(p_contest uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  c public.contests;
  my public.profiles;
begin
  if me is null then
    raise exception 'Нужно войти' using errcode = '42501';
  end if;
  select * into c from public.contests where id = p_contest;
  if c.id is null or c.status <> 'active' or c.ends_at <= now() then
    raise exception 'Розыгрыш уже закончился' using errcode = '23514';
  end if;
  if c.organizer_id = me then
    raise exception 'В своём розыгрыше участвовать нельзя' using errcode = '23514';
  end if;
  if exists (select 1 from public.blocks
              where (blocker_id = me and blocked_id = c.organizer_id)
                 or (blocker_id = c.organizer_id and blocked_id = me)) then
    raise exception 'Участвовать в этом розыгрыше нельзя' using errcode = '42501';
  end if;
  select * into my from public.profiles where id = me;
  -- Заполненный профиль (имя, город, пара слов о себе) или своя публикация — участвовать можно сразу,
  -- иначе — через 7 дней после регистрации (защита от аккаунтов «на один розыгрыш»).
  if my.created_at > now() - interval '7 days'
     and not private.profile_complete(my)
     and not exists (select 1 from public.posts where author_id = me and deleted_at is null) then
    raise exception 'Заполните профиль или опубликуйте первый пост — или подождите 7 дней после регистрации'
      using errcode = '23514';
  end if;
  if not exists (select 1 from public.plants
                  where owner_id = me and deleted_at is null and cover_photo_id is not null) then
    raise exception 'Добавьте в коллекцию растение со своим фото' using errcode = '23514';
  end if;
  if not c.delivery and lower(btrim(coalesce(my.city, ''))) <> lower(btrim(c.city)) then
    raise exception 'Без доставки — только для садоводов из города %', c.city using errcode = '23514';
  end if;
  insert into public.contest_entries (contest_id, user_id) values (p_contest, me)
  on conflict do nothing;
end;
$$;
