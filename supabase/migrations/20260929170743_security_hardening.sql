-- Закрываем найденные при проверке безопасности лазейки: клиент мог записать поля,
-- которые должна вести сама база, и сослаться на чужие записи по id.

-- 1. Счётчики поддержки и комментариев ведут триггеры likes_count/comments_count.
--    Раньше пост можно было создать сразу с like_count = 9999 (и получить за это достижения).
--    Право на всю таблицу меняем на список полей, которые заполняет сам автор.
revoke insert on public.posts from authenticated;
revoke insert (like_count, comment_count, edited_at, deleted_at, solved_comment_id, created_at)
  on public.posts from authenticated;
grant insert (id, author_id, kind, text, photo_paths, plant_id, species_id, event, visibility)
  on public.posts to authenticated;

-- 2. Пост о растении — только о своём: чужое растение (в том числе скрытое) не прикрепить.
create or replace function private.posts_check_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.plant_id is not null
     and (tg_op = 'INSERT' or new.plant_id is distinct from old.plant_id) then
    if not exists (select 1 from public.plants where id = new.plant_id and owner_id = new.author_id) then
      raise exception 'Можно написать только о своём растении' using errcode = '42501';
    end if;
    new.species_id := coalesce(
      (select species_id from public.plants where id = new.plant_id),
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

-- 3. Комментарий нельзя «перенести» под другой пост (в том числе закрытый или от того, кто
--    заблокировал автора): после создания меняются только текст и отметка удаления.
revoke update on public.comments from authenticated;
revoke update (id, post_id, parent_id, author_id, created_at) on public.comments from authenticated;
grant update (text, deleted_at) on public.comments to authenticated;

-- 4. Ссылки растения — только на своё: обложка — фото этого же растения, место — своё,
--    «родитель» (черенок от…) — растение, которое автору видно.
create or replace function private.plants_check_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.cover_photo_id is not null
     and (tg_op = 'INSERT' or new.cover_photo_id is distinct from old.cover_photo_id)
     and not exists (select 1 from public.plant_photos where id = new.cover_photo_id and plant_id = new.id) then
    raise exception 'Обложка — только фото этого растения' using errcode = '42501';
  end if;
  if new.location_id is not null
     and (tg_op = 'INSERT' or new.location_id is distinct from old.location_id)
     and not exists (select 1 from public.locations where id = new.location_id and owner_id = new.owner_id) then
    raise exception 'Место — только из своих' using errcode = '42501';
  end if;
  if new.parent_plant_id is not null
     and (tg_op = 'INSERT' or new.parent_plant_id is distinct from old.parent_plant_id)
     and not (exists (select 1 from public.plants where id = new.parent_plant_id and owner_id = new.owner_id)
              or private.can_view_plant(new.parent_plant_id)) then
    raise exception 'Растение-родитель недоступно' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger plants_check_refs
  before insert or update of cover_photo_id, location_id, parent_plant_id on public.plants
  for each row execute function private.plants_check_refs();

-- 5. Фото в записи ухода — только снимок этого же растения.
create or replace function private.care_events_check_photo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.photo_id is not null
     and not exists (select 1 from public.plant_photos where id = new.photo_id and plant_id = new.plant_id) then
    raise exception 'Фото — только этого растения' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger care_events_check_photo
  before insert on public.care_events
  for each row execute function private.care_events_check_photo();

-- 6. Имена команды не занять: «podokonnik», «admin», «Команда Подоконника» и т. п.
--    Проверяется только смена имени, администраторам можно.
create or replace function private.profiles_reserved_names()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if private.is_admin() then
    return new;
  end if;
  if new.username is distinct from old.username
     and lower(new.username) ~ '^(podokonnik.*|podokonnikapp|admin|administrator|moderator|support|official|team|help|root|system)$' then
    raise exception 'Это имя зарезервировано' using errcode = '23514';
  end if;
  if new.display_name is distinct from old.display_name
     and new.display_name ~* '^\s*(команда\s+)?(подоконник|podokonnik)|администрац|модератор|служба\s+поддержки|техподдержка' then
    raise exception 'Это имя зарезервировано' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger profiles_reserved_names
  before update of username, display_name on public.profiles
  for each row execute function private.profiles_reserved_names();

-- 7. В хранилище — только сжатые снимки JPEG (так их загружает сайт), не больше 10 МБ:
--    нельзя выложить на наш домен HTML-страницу или гигабайтный файл.
update storage.buckets
   set file_size_limit = 10 * 1024 * 1024,
       allowed_mime_types = array['image/jpeg']
 where id in ('plant-photos', 'post-photos', 'avatars', 'listing-photos');
