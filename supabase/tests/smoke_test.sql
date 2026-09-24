-- Дымовой тест миграций: права доступа (RLS), расчёт графика полива, счётчики, RPC.
-- Запуск: scripts/check-migrations.sh

\set ON_ERROR_STOP 1
set timezone = 'UTC';

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@example.com');

do $$ begin
  assert (select count(*) from public.profiles) = 3, 'профили создаются при регистрации';
  assert (select username from public.profiles where id = '00000000-0000-0000-0000-00000000000a')
         = 'alice_00000000', 'username из email + суффикс id';
end $$;

-- Алиса блокирует Кэрол (от имени Алисы)
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.blocks (blocker_id, blocked_id)
values (auth.uid(), '00000000-0000-0000-0000-00000000000c');

-- Алиса: место, растение, график полива. Лето, пластиковый горшок, яркий рассеянный свет:
-- 7 × 0.85 (лето) × 1.1 (пластик) × 1.0 (свет) = 6.545 → 6.5 дня.
insert into public.locations (id, name, light_level)
values ('10000000-0000-0000-0000-000000000001', 'Гостиная', 'bright_indirect');
insert into public.plants (id, nickname, species_id, location_id, pot_material, visibility)
values ('20000000-0000-0000-0000-000000000001', 'Монстера Мося',
        (select id from public.species where slug = 'monstera-deliciosa'),
        '10000000-0000-0000-0000-000000000001', 'plastic', 'followers');
insert into public.care_schedules (id, plant_id, type, interval_days, last_done_at)
values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
        'water', 7, '2026-07-01 00:00+00');

do $$ begin
  assert (select next_due_at from public.care_schedules
           where id = '30000000-0000-0000-0000-000000000001') = '2026-07-07 12:00+00',
         'летний интервал 6.5 дня';
end $$;

-- Боб не подписан — растение не видит и полить не может.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert (select count(*) from public.plants) = 0, 'чужое растение для подписчиков скрыто';
end $$;
do $$ begin
  insert into public.care_events (plant_id, type, performed_at)
  values ('20000000-0000-0000-0000-000000000001', 'water', '2026-07-07 00:00+00');
  raise exception 'Боб не должен поливать чужое растение';
exception when insufficient_privilege then null;
end $$;

-- Боб подписывается — теперь видит.
insert into public.follows (follower_id, followee_id)
values (auth.uid(), '00000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select count(*) from public.plants) = 1, 'подписчик видит растение';
  assert (select count(*) from public.care_schedules) = 1, 'подписчик видит график';
end $$;

-- Кэрол заблокирована: подписаться нельзя.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  insert into public.follows (follower_id, followee_id)
  values (auth.uid(), '00000000-0000-0000-0000-00000000000a');
  raise exception 'заблокированный не должен подписываться';
exception when insufficient_privilege then null;
end $$;

-- Алиса делает Боба помощником (уезжает в отпуск).
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.plant_caretakers (plant_id, user_id)
values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b');

-- Боб поливает через 6 дней вместо 6.5 → коэффициент 1 × (0.8 + 0.2 × 6/6.5) = 0.98,
-- новый интервал 7 × 0.98 × 0.935 = 6.41 → 6.4 дня.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into public.care_events (plant_id, type, performed_at)
values ('20000000-0000-0000-0000-000000000001', 'water', '2026-07-07 00:00+00');

do $$
declare s public.care_schedules;
begin
  select * into s from public.care_schedules where id = '30000000-0000-0000-0000-000000000001';
  assert s.last_done_at = '2026-07-07 00:00+00', 'полив сдвигает last_done_at';
  assert s.user_factor = 0.98, format('коэффициент подстроился: %s', s.user_factor);
  assert s.next_due_at = '2026-07-13 09:36+00', format('следующий полив: %s', s.next_due_at);
end $$;

-- Событие задним числом не откатывает график.
insert into public.care_events (plant_id, type, performed_at)
values ('20000000-0000-0000-0000-000000000001', 'water', '2026-07-03 00:00+00');
do $$ begin
  assert (select last_done_at from public.care_schedules
           where id = '30000000-0000-0000-0000-000000000001') = '2026-07-07 00:00+00',
         'старое событие игнорируется';
end $$;

-- Служебные поля клиенту менять нельзя.
do $$ begin
  update public.care_schedules set user_factor = 2 where id = '30000000-0000-0000-0000-000000000001';
  raise exception 'user_factor не должен обновляться клиентом';
exception when insufficient_privilege then null;
end $$;

-- Смена горшка на терракоту пересчитывает график: 7 × 0.98 × 0.85 × 0.85 = 4.96 → 5.0.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update public.plants set pot_material = 'terracotta' where id = '20000000-0000-0000-0000-000000000001';
do $$ begin
  assert (select next_due_at from public.care_schedules
           where id = '30000000-0000-0000-0000-000000000001') = '2026-07-12 00:00+00',
         'пересчёт после смены горшка';
end $$;

-- Зимой в южном полушарии (июль) интервал длиннее: 7 × 0.98 × 1.4 × 0.85 = 8.16 → 8.2.
do $$ begin
  assert public.effective_interval_days('water', 7, 0.98, true, 7, 'S', 'terracotta', 'bright_indirect')
         = 8.2, 'южное полушарие';
  assert public.effective_interval_days('water', 7, 1, false, 1, 'N', 'terracotta', 'low')
         = 7, 'без автоподстройки интервал не меняется';
  assert public.effective_interval_days('repot', 365, 1, true, 1, 'N', 'plastic', 'low')
         = 365, 'сезон не влияет на пересадку';
end $$;

-- Что полить: у Алисы и у Боба (помощника) растение в списке.
do $$ begin
  assert (select count(*) from public.care_due('2026-08-01')) = 1, 'care_due у владельца';
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert (select count(*) from public.care_due('2026-08-01')) = 1, 'care_due у помощника';
end $$;

-- Лента, лайки, счётчики, блокировка.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.posts (id, plant_id, text, visibility)
values ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
        'Новый лист!', 'public');

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into public.likes (user_id, post_id) values (auth.uid(), '40000000-0000-0000-0000-000000000001');
insert into public.comments (post_id, text) values ('40000000-0000-0000-0000-000000000001', 'Красота!');
do $$ begin
  assert (select count(*) from public.feed_following()) = 1, 'пост в ленте подписчика';
  assert (select like_count from public.posts where id = '40000000-0000-0000-0000-000000000001') = 1,
         'счётчик лайков';
  assert (select comment_count from public.posts where id = '40000000-0000-0000-0000-000000000001') = 1,
         'счётчик комментариев';
end $$;
do $$ begin
  update public.posts set like_count = 100 where id = '40000000-0000-0000-0000-000000000001';
  raise exception 'like_count не должен обновляться клиентом';
exception when insufficient_privilege then null;
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  assert (select count(*) from public.posts) = 0, 'заблокированный не видит публичные посты';
  assert (select count(*) from public.feed_discover()) = 0, 'и в «Интересном» тоже';
end $$;

-- Поиск по базе знаний (доступен и гостям).
set role anon;
set request.jwt.claim.sub = '';
do $$ begin
  assert (select slug from public.search_species('монстера') limit 1) = 'monstera-deliciosa',
         'поиск по русскому названию';
  assert (select slug from public.search_species('тёщин язык') limit 1) = 'dracaena-trifasciata',
         'поиск по народному названию';
  assert (select slug from public.search_species('sansevieria') limit 1) = 'dracaena-trifasciata',
         'поиск по синониму';
  assert (select slug from public.search_species('fikus elastika') limit 1) = 'ficus-elastica',
         'поиск с опечатками';
  assert (select count(*) from public.plants) = 0, 'гость не видит растения';
end $$;

reset role;
\echo 'smoke test: OK'
