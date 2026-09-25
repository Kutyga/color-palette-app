-- Закрепление прав на функции.
-- В Supabase EXECUTE на новые функции по умолчанию выдаётся anon и authenticated, а
-- security definer обходит RLS. Поэтому:
--   • триггерные функции нельзя вызвать напрямую никому (триггеры работают и так);
--   • помощники для RLS и расчётов доступны только вошедшим пользователям;
--   • сервисные функции (ingest_news) — только service_role.

revoke execute on function
  public.handle_new_user(),
  public.care_events_apply(),
  public.plants_recompute_schedules(),
  public.locations_recompute_schedules(),
  public.posts_like_count(),
  public.posts_comment_count(),
  public.care_schedules_compute_due(),
  public.species_search_refresh(),
  public.set_updated_at()
from public, anon, authenticated;

revoke execute on function
  public.is_blocked_by(uuid),
  public.can_view(uuid, text),
  public.is_caretaker(uuid),
  public.can_view_plant(uuid),
  public.can_care_plant(uuid),
  public.owns_plant(uuid),
  public.can_view_post(uuid),
  public.schedule_interval_days(public.care_schedules, timestamptz),
  public.my_garden_stats(),
  public.care_due(timestamptz),
  public.feed_following(timestamptz, uuid, int),
  public.feed_discover(int, int)
from public, anon;

grant execute on function
  public.is_blocked_by(uuid),
  public.can_view(uuid, text),
  public.is_caretaker(uuid),
  public.can_view_plant(uuid),
  public.can_care_plant(uuid),
  public.owns_plant(uuid),
  public.can_view_post(uuid),
  public.schedule_interval_days(public.care_schedules, timestamptz),
  public.my_garden_stats(),
  public.care_due(timestamptz),
  public.feed_following(timestamptz, uuid, int),
  public.feed_discover(int, int)
to authenticated;
