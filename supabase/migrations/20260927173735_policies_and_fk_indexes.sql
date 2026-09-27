-- Порядок в правах доступа и индексах (по замечаниям Supabase Advisors). Права не меняются.
--
-- 1. Одна политика на действие. Раньше у таблиц была политика «ALL» для владельца и отдельная
--    «SELECT» для остальных — на чтении Postgres вычислял обе. Теперь чтение — одна политика
--    с условием «своё ИЛИ видно по правилам» (дешёвое сравнение с auth.uid() — первым),
--    а запись — отдельные INSERT / UPDATE / DELETE с прежними условиями.
-- 2. Индексы для внешних ключей без индекса: без них удаление строки, на которую ссылаются,
--    просматривает всю ссылающуюся таблицу.

-- ---------------------------------------------------------------------------
-- plants: своё растение или видимое по приватности
-- ---------------------------------------------------------------------------
drop policy plants_own on public.plants;
drop policy plants_read_shared on public.plants;

create policy plants_read on public.plants for select to authenticated
  using (owner_id = (select auth.uid()) or private.can_view_plant(id));
create policy plants_insert on public.plants for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy plants_update on public.plants for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy plants_delete on public.plants for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- care_schedules: читать — кто видит растение, менять — кто ухаживает
-- ---------------------------------------------------------------------------
drop policy schedules_read on public.care_schedules;
drop policy schedules_write on public.care_schedules;

create policy schedules_read on public.care_schedules for select to authenticated
  using (private.can_view_plant(plant_id) or private.can_care_plant(plant_id));
create policy schedules_insert on public.care_schedules for insert to authenticated
  with check (private.can_care_plant(plant_id));
create policy schedules_update on public.care_schedules for update to authenticated
  using (private.can_care_plant(plant_id)) with check (private.can_care_plant(plant_id));
create policy schedules_delete on public.care_schedules for delete to authenticated
  using (private.can_care_plant(plant_id));

-- ---------------------------------------------------------------------------
-- care_events: ошибочную отметку удаляет её автор или хозяин растения
-- ---------------------------------------------------------------------------
drop policy events_delete_own on public.care_events;
drop policy events_delete_owner on public.care_events;

create policy events_delete on public.care_events for delete to authenticated
  using (performed_by = (select auth.uid()) or private.owns_plant(plant_id));

-- ---------------------------------------------------------------------------
-- plant_caretakers: список видят хозяин и сам помощник; помощник может выйти сам
-- ---------------------------------------------------------------------------
drop policy caretakers_leave on public.plant_caretakers;
drop policy caretakers_manage on public.plant_caretakers;
drop policy caretakers_read on public.plant_caretakers;

create policy caretakers_read on public.plant_caretakers for select to authenticated
  using (user_id = (select auth.uid()) or private.owns_plant(plant_id));
create policy caretakers_insert on public.plant_caretakers for insert to authenticated
  with check (private.owns_plant(plant_id));
create policy caretakers_update on public.plant_caretakers for update to authenticated
  using (private.owns_plant(plant_id)) with check (private.owns_plant(plant_id));
create policy caretakers_delete on public.plant_caretakers for delete to authenticated
  using (user_id = (select auth.uid()) or private.owns_plant(plant_id));

-- ---------------------------------------------------------------------------
-- posts: свои записи (в том числе удалённые) и не удалённые, видимые по приватности
-- ---------------------------------------------------------------------------
drop policy posts_own on public.posts;
drop policy posts_read on public.posts;

create policy posts_read on public.posts for select to authenticated
  using (author_id = (select auth.uid())
         or (deleted_at is null and private.can_view(author_id, visibility)));
create policy posts_insert on public.posts for insert to authenticated
  with check (author_id = (select auth.uid()));
create policy posts_update on public.posts for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy posts_delete on public.posts for delete to authenticated
  using (author_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- shop_products: каталог видит тот, кому виден магазин; меняет владелец
-- ---------------------------------------------------------------------------
drop policy shop_products_read on public.shop_products;
drop policy shop_products_write on public.shop_products;

create policy shop_products_read on public.shop_products for select to authenticated
  using (private.owns_shop(shop_id) or private.can_view_shop(shop_id));
create policy shop_products_insert on public.shop_products for insert to authenticated
  with check (private.owns_shop(shop_id));
create policy shop_products_update on public.shop_products for update to authenticated
  using (private.owns_shop(shop_id)) with check (private.owns_shop(shop_id));
create policy shop_products_delete on public.shop_products for delete to authenticated
  using (private.owns_shop(shop_id));

-- ---------------------------------------------------------------------------
-- wishlist_items: свой список и списки тех, на кого подписан
-- ---------------------------------------------------------------------------
drop policy wishlist_own on public.wishlist_items;
drop policy wishlist_read_followers on public.wishlist_items;

create policy wishlist_read on public.wishlist_items for select to authenticated
  using (user_id = (select auth.uid()) or private.can_view(user_id, 'followers'));
create policy wishlist_insert on public.wishlist_items for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy wishlist_update on public.wishlist_items for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy wishlist_delete on public.wishlist_items for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Индексы для внешних ключей
-- ---------------------------------------------------------------------------
create index if not exists care_events_photo_idx on public.care_events (photo_id);
create index if not exists comments_parent_idx on public.comments (parent_id);
create index if not exists genera_family_idx on public.genera (family_id);
create index if not exists kb_article_species_species_idx on public.kb_article_species (species_id);
create index if not exists plant_photos_uploaded_by_idx on public.plant_photos (uploaded_by);
create index if not exists plants_cover_photo_idx on public.plants (cover_photo_id);
create index if not exists plants_parent_plant_idx on public.plants (parent_plant_id);
create index if not exists reports_reporter_idx on public.reports (reporter_id);
create index if not exists species_genus_idx on public.species (genus_id);
create index if not exists species_diseases_disease_idx on public.species_diseases (disease_id);
create index if not exists wishlist_alert_log_species_idx on private.wishlist_alert_log (species_id);
