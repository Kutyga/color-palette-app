-- Мягкое удаление комментария (update deleted_at) требует, чтобы обновлённая строка
-- оставалась видимой автору по правилу чтения. Автор видит свои комментарии всегда,
-- остальные — только неудалённые на доступных им постах.
drop policy comments_read on public.comments;
create policy comments_read on public.comments for select to authenticated
  using (author_id = (select auth.uid())
         or (deleted_at is null and private.can_view_post(post_id)));
