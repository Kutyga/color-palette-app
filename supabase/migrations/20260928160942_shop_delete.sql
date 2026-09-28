-- Владелец может удалить свой магазин (каталог удаляется вместе с ним — on delete cascade),
-- администратор — любой.
create policy shops_delete on public.shops for delete to authenticated
  using (owner_id = (select auth.uid()) or private.is_admin());
grant delete on public.shops to authenticated;
