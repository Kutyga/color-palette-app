-- Хранилище фото.
-- Пути: plant-photos/{uploader_id}/{plant_id}/{photo_id}.jpg
--       post-photos/{author_id}/{post_id}/{n}.jpg
--       avatars/{user_id}/avatar.jpg
-- Клиент удаляет EXIF-геометку и сжимает изображение до загрузки.

insert into storage.buckets (id, name, public)
values
  ('plant-photos', 'plant-photos', false),
  ('post-photos',  'post-photos',  false),
  ('avatars',      'avatars',      true),
  ('kb-images',    'kb-images',    true)
on conflict (id) do nothing;

create or replace function public.try_uuid(p text)
returns uuid
language plpgsql
immutable
set search_path = public, extensions
as $$
begin
  return p::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create policy plant_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'plant-photos'
         and public.can_view_plant(public.try_uuid((storage.foldername(name))[2])));

create policy plant_photos_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'plant-photos'
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and public.can_care_plant(public.try_uuid((storage.foldername(name))[2])));

create policy plant_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'plant-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy post_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'post-photos'
         and ((storage.foldername(name))[1] = (select auth.uid())::text
              or public.can_view_post(public.try_uuid((storage.foldername(name))[2]))));

create policy post_photos_write on storage.objects for insert to authenticated
  with check (bucket_id = 'post-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy post_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'post-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatars_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
