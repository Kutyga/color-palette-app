-- Автор может удалить свою публикацию в любое время (мягко, deleted_at) и отредактировать её
-- в течение часа после публикации. Правило проверяет база, а не только интерфейс.

alter table public.posts add column edited_at timestamptz;

create or replace function private.posts_guard_edit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.kind is distinct from old.kind then
    raise exception 'Тип публикации менять нельзя' using errcode = '23514';
  end if;
  if (new.text, new.event, new.plant_id, new.photo_paths, new.visibility, new.species_id)
     is distinct from
     (old.text, old.event, old.plant_id, old.photo_paths, old.visibility, old.species_id) then
    if old.deleted_at is not null then
      raise exception 'Публикация удалена' using errcode = '23514';
    end if;
    if now() - old.created_at > interval '1 hour' then
      raise exception 'Публикацию можно редактировать только в течение часа' using errcode = '23514';
    end if;
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create trigger posts_guard_edit
  before update on public.posts
  for each row execute function private.posts_guard_edit();
