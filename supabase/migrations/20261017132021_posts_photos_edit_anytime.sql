-- Фото в записи дневника можно поменять в любой момент («случайно выложила фото хлеба»):
-- текст, событие, растение и видимость — по-прежнему только в течение часа; у вопросов фото — тоже час.
-- В записи дневника (есть событие) должно остаться хотя бы одно фото.
create or replace function private.posts_guard_edit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.kind is distinct from old.kind then
    raise exception 'Тип публикации менять нельзя' using errcode = '23514';
  end if;
  if (new.text, new.event, new.plant_id, new.visibility, new.species_id)
     is distinct from
     (old.text, old.event, old.plant_id, old.visibility, old.species_id)
     or (new.photo_paths is distinct from old.photo_paths and old.kind = 'question') then
    if old.deleted_at is not null then
      raise exception 'Публикация удалена' using errcode = '23514';
    end if;
    if now() - old.created_at > interval '1 hour' then
      raise exception 'Публикацию можно редактировать только в течение часа' using errcode = '23514';
    end if;
    new.edited_at := now();
  elsif new.photo_paths is distinct from old.photo_paths then
    if old.deleted_at is not null then
      raise exception 'Публикация удалена' using errcode = '23514';
    end if;
    if old.event is not null and cardinality(new.photo_paths) = 0 then
      raise exception 'В записи дневника нужно хотя бы одно фото' using errcode = '23514';
    end if;
    new.edited_at := now();
  end if;
  return new;
end;
$$;
