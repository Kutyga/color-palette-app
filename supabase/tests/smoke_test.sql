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

-- Комментарий удаляется мягко (deleted_at), счётчик уменьшается триггером.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
update public.comments set deleted_at = now()
 where post_id = '40000000-0000-0000-0000-000000000001' and author_id = auth.uid();
do $$ begin
  assert (select comment_count from public.posts where id = '40000000-0000-0000-0000-000000000001') = 0,
         'счётчик после удаления комментария';
end $$;

-- Дневники и Помощь: вид берётся из растения, лучший ответ отмечает только автор вопроса
-- и только ответом на этот же вопрос.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.posts (id, kind, event, plant_id, text, visibility) values
  ('40000000-0000-0000-0000-000000000002', 'milestone', 'bloom',
   '20000000-0000-0000-0000-000000000001', 'Зацвела!', 'public'),
  ('40000000-0000-0000-0000-000000000003', 'question', null,
   '20000000-0000-0000-0000-000000000001', 'Желтеют нижние листья — что делать?', 'public');
insert into public.comments (id, post_id, text)
values ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'Спасибо!');
do $$ begin
  assert (select species_id from public.posts where id = '40000000-0000-0000-0000-000000000003')
         = (select id from public.species where slug = 'monstera-deliciosa'), 'вид вопроса из растения';
  assert (select count(*) from public.feed_diaries()) = 2, 'в дневниках старый пост и новая запись';
  assert (select count(*) from public.feed_diaries()
           where id = '40000000-0000-0000-0000-000000000003') = 0, 'вопрос не попадает в дневники';
  assert (select count(*) from public.help_questions('mine')) = 1, 'мои вопросы';
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into public.comments (id, post_id, text)
values ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003',
        'Похоже на перелив — проверьте дренаж.');
-- Боб не автор: обновление не затрагивает строк.
update public.posts set solved_comment_id = '50000000-0000-0000-0000-000000000001'
 where id = '40000000-0000-0000-0000-000000000003';
do $$ begin
  assert (select count(*) from public.feed_diaries('following')) = 2, 'дневники подписок у Боба';
  assert (select count(*) from public.help_questions('open')) = 1, 'вопрос без лучшего ответа';
  assert (select count(*) from public.help_questions('my_species')) = 0, 'у Боба нет растений';
  assert (select solved_comment_id from public.posts where id = '40000000-0000-0000-0000-000000000003') is null,
         'чужой вопрос отметить нельзя';
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  update public.posts set solved_comment_id = '50000000-0000-0000-0000-000000000002'
   where id = '40000000-0000-0000-0000-000000000003';
  raise exception 'нельзя отметить ответ с другого поста';
exception when check_violation then null;
end $$;
update public.posts set solved_comment_id = '50000000-0000-0000-0000-000000000001'
 where id = '40000000-0000-0000-0000-000000000003';
do $$ begin
  assert (select count(*) from public.help_questions('open')) = 0, 'решённый вопрос уходит из «Без ответа»';
  assert (select count(*) from public.help_questions('my_species')) = 1, 'вопрос про мой вид';
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  assert (select count(*) from public.help_questions('all')) = 0, 'заблокированный не видит вопросы';
end $$;

-- Правка своей публикации — в течение часа, удаление — в любое время, чужие — никогда.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update public.posts set text = 'Зацвела! Первый бутон', event = 'bloom'
 where id = '40000000-0000-0000-0000-000000000002';
do $$ begin
  assert (select text from public.posts where id = '40000000-0000-0000-0000-000000000002') = 'Зацвела! Первый бутон',
         'автор правит свежую запись';
  assert (select edited_at from public.posts where id = '40000000-0000-0000-0000-000000000002') is not null,
         'отметка «изменено»';
end $$;
do $$ begin
  update public.posts set kind = 'question' where id = '40000000-0000-0000-0000-000000000002';
  raise exception 'тип публикации менять нельзя';
exception when check_violation then null;
end $$;

reset role;
update public.posts set created_at = now() - interval '2 hours'
 where id = '40000000-0000-0000-0000-000000000002';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  update public.posts set text = 'поздно' where id = '40000000-0000-0000-0000-000000000002';
  raise exception 'через час править нельзя';
exception when check_violation then null;
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
update public.posts set deleted_at = now() where id = '40000000-0000-0000-0000-000000000002';
update public.posts set text = 'чужое' where id = '40000000-0000-0000-0000-000000000003';
do $$ begin
  assert (select count(*) from public.feed_diaries('following')
           where id = '40000000-0000-0000-0000-000000000002') = 1, 'чужую запись удалить нельзя';
  assert (select text from public.posts where id = '40000000-0000-0000-0000-000000000003')
         = 'Желтеют нижние листья — что делать?', 'чужой вопрос не правится';
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update public.posts set deleted_at = now() where id = '40000000-0000-0000-0000-000000000002';
do $$ begin
  assert (select count(*) from public.feed_diaries()
           where id = '40000000-0000-0000-0000-000000000002') = 0, 'автор удаляет и старую запись';
end $$;

-- Барахолка и личные сообщения.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.listings (id, kind, title, price_rub, city, photo_paths, species_id)
values ('60000000-0000-0000-0000-000000000001', 'sell', 'Детка монстеры', 500, 'Казань',
        array['00000000-0000-0000-0000-00000000000a/60000000-0000-0000-0000-000000000001/0.jpg'],
        (select id from public.species where slug = 'monstera-deliciosa'));
do $$ begin
  insert into public.listings (kind, title, city, photo_paths) values ('sell', 'Без цены', 'Казань', array['x']);
  raise exception 'у «Продаю» цена обязательна';
exception when check_violation then null;
end $$;
do $$ begin
  insert into public.listings (kind, title, city) values ('free', 'Без фото', 'Казань');
  raise exception 'без фото можно только «Ищу»';
exception when check_violation then null;
end $$;
insert into public.listings (kind, title, city) values ('wanted', 'Ищу хойю керри', 'Казань');
do $$ begin
  perform public.start_conversation('60000000-0000-0000-0000-000000000001');
  raise exception 'писать себе нельзя';
exception when check_violation then null;
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$
declare c1 uuid; c2 uuid;
begin
  assert (select count(*) from public.listings) = 2, 'Боб видит объявления';
  c1 := public.start_conversation('60000000-0000-0000-0000-000000000001');
  c2 := public.start_conversation('60000000-0000-0000-0000-000000000001');
  assert c1 = c2, 'повторно открывается тот же чат';
  insert into public.messages (conversation_id, body) values (c1, 'Здравствуйте! Ещё продаёте?');
  assert (select last_message from public.conversations where id = c1) = 'Здравствуйте! Ещё продаёте?',
         'последнее сообщение в карточке чата';
  assert (select unread from public.my_conversations()) = false, 'своё сообщение не непрочитанное';
end $$;
do $$ begin
  update public.listings set price_rub = 1 where id = '60000000-0000-0000-0000-000000000001';
  assert (select price_rub from public.listings where id = '60000000-0000-0000-0000-000000000001') = 500,
         'чужое объявление не меняется';
  insert into public.conversations (buyer_id, seller_id)
  values (auth.uid(), '00000000-0000-0000-0000-00000000000a');
  raise exception 'чат напрямую не создаётся';
exception when insufficient_privilege then null;
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare conv uuid := (select id from public.conversations limit 1);
begin
  assert (select unread from public.my_conversations()) = true, 'у продавца непрочитанное';
  assert (select other_display_name from public.my_conversations()) = 'Bob', 'собеседник';
  perform public.mark_conversation_read(conv);
  assert (select unread from public.my_conversations()) = false, 'прочитано';
  insert into public.messages (conversation_id, body) values (conv, 'Да, приезжайте');
  assert (select count(*) from public.messages where conversation_id = conv) = 2, 'продавец отвечает';
end $$;
update public.listings set status = 'reserved' where id = '60000000-0000-0000-0000-000000000001';

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  assert (select count(*) from public.listings) = 0, 'заблокированный не видит объявления';
  assert (select count(*) from public.messages) = 0, 'и чужую переписку';
  assert (select count(*) from public.conversations) = 0, 'и чужие чаты';
end $$;
do $$ begin
  perform public.start_conversation('60000000-0000-0000-0000-000000000001');
  raise exception 'заблокированный не может написать';
exception when no_data_found then null;
end $$;

-- После блокировки переписка закрыта для обоих.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), '00000000-0000-0000-0000-00000000000b');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  insert into public.messages (conversation_id, body)
  values ((select id from public.conversations limit 1), 'Ау?');
  raise exception 'после блокировки писать нельзя';
exception when insufficient_privilege then null;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  assert (select blocked from public.my_conversations()) = true, 'чат помечен заблокированным';
end $$;
delete from public.blocks where blocker_id = auth.uid() and blocked_id = '00000000-0000-0000-0000-00000000000b';

-- Фото растения: владелец загружает в свою папку и ставит обложку; посторонний — нет.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into storage.objects (bucket_id, name)
values ('plant-photos', '00000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000001/p1.jpg');
insert into public.plant_photos (id, plant_id, storage_path)
values ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000001/p1.jpg');
update public.plants set cover_photo_id = '50000000-0000-0000-0000-000000000001'
 where id = '20000000-0000-0000-0000-000000000001';
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  insert into storage.objects (bucket_id, name)
  values ('plant-photos', '00000000-0000-0000-0000-00000000000c/20000000-0000-0000-0000-000000000001/x.jpg');
  raise exception 'посторонний не должен загружать фото чужого растения';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  assert (select count(*) from storage.objects where bucket_id = 'plant-photos') = 0,
         'заблокированный не видит фото растения';
end $$;

-- Статистика для геймификации: у Боба два полива (3 и 7 июля) — серия прервалась,
-- лучшая серия 1 день; растений нет.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$
declare st jsonb := public.my_garden_stats();
begin
  assert (st ->> 'waterings')::int = 2, format('поливы Боба: %s', st);
  assert (st ->> 'plants')::int = 0, 'у Боба нет своих растений';
  assert (st ->> 'best_streak')::int = 1, format('лучшая серия: %s', st);
  assert (st ->> 'current_streak')::int = 0, 'старые поливы не дают текущую серию';
end $$;

-- Алиса поливает три дня подряд до сегодня включительно → серия 3.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.care_events (plant_id, type, performed_at)
select '20000000-0000-0000-0000-000000000001', 'mist', date_trunc('day', now()) - make_interval(days => n) + interval '6 hours'
  from generate_series(0, 2) as n;
do $$
declare st jsonb := public.my_garden_stats();
begin
  assert (st ->> 'plants')::int = 1, 'растение Алисы';
  assert (st ->> 'species')::int = 1, 'один вид';
  assert (st ->> 'mistings')::int = 3, 'опрыскивания';
  assert (st ->> 'early_bird')::int = 3, 'уход в 6 утра — ранняя пташка';
  assert (st ->> 'current_streak')::int = 3, format('текущая серия: %s', st);
end $$;

-- Новости: сборщик (service_role) вставляет статьи, дубликаты по URL пропускаются,
-- упомянутые виды проставляются автоматически.
reset role;
do $$
declare
  src uuid := (select id from public.news_sources where name = 'Ботаничка');
  n int;
begin
  n := public.ingest_news(src, '[
    {"url": "https://example.org/a", "title": "Как спасти монстеру после перелива", "summary": "Monstera deliciosa не любит холодную воду", "published_at": "2026-09-20T10:00:00Z"},
    {"url": "https://example.org/a", "title": "Дубликат", "summary": ""},
    {"url": "javascript:alert(1)", "title": "Плохая ссылка"},
    {"url": "https://example.org/b", "title": "Осенняя подкормка", "summary": "Что делать в октябре", "published_at": "2026-09-21T10:00:00Z"}
  ]'::jsonb);
  assert n = 2, format('вставлено %s', n);
  assert (select species_ids from public.news_articles where url = 'https://example.org/a')
         = array[(select id from public.species where slug = 'monstera-deliciosa')], 'распознан вид';
end $$;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  assert (select count(*) from public.news_feed()) = 2, 'лента новостей';
  assert (select title from public.news_feed() limit 1) = 'Осенняя подкормка', 'свежие сверху';
  assert (select count(*) from public.news_feed(only_my_species => true)) = 1, 'новости про мои растения';
  assert (select count(*) from public.news_feed(langs => array['ru'])) = 2, 'фильтр по языку';
  assert (select count(*) from public.news_feed(langs => array['de'])) = 0, 'чужой язык отфильтрован';
  assert (select articles from public.news_languages() where language = 'ru') = 2, 'список языков';
end $$;
do $$ begin
  perform public.ingest_news((select id from public.news_sources limit 1), '[]'::jsonb);
  raise exception 'пользователь не должен вызывать ingest_news';
exception when insufficient_privilege then null;
end $$;

-- Секрет вызова сборщика новостей проверяет только service_role.
reset role;
do $$ begin
  assert public.verify_news_ingest_secret((select decrypted_secret from vault.decrypted_secrets where name = 'news_ingest_secret')), 'верный секрет';
  assert not public.verify_news_ingest_secret('wrong'), 'неверный секрет';
  assert not public.verify_news_ingest_secret(null), 'пустой секрет';
end $$;
set role authenticated;
do $$ begin
  perform public.verify_news_ingest_secret('x');
  raise exception 'пользователь не должен проверять секрет';
exception when insufficient_privilege then null;
end $$;

-- Квоты распознавания: 2 в день на пользователя, общая больше.
reset role;
do $$
declare u uuid := '00000000-0000-0000-0000-00000000000a';
begin
  assert public.consume_identify_quota(u, 2, 100), 'первое распознавание';
  assert public.consume_identify_quota(u, 2, 100), 'второе распознавание';
  assert not public.consume_identify_quota(u, 2, 100), 'лимит на пользователя';
  assert public.consume_identify_quota('00000000-0000-0000-0000-00000000000b', 2, 100), 'другой пользователь';
  assert not public.consume_identify_quota('00000000-0000-0000-0000-00000000000c', 2, 4), 'общий лимит';
end $$;
set role authenticated;
do $$ begin
  perform public.get_plantnet_key();
  raise exception 'пользователь не должен получать ключ Pl@ntNet';
exception when insufficient_privilege then null;
end $$;

-- Люди: поиск, карточки, подписчики, редактирование профиля.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$
declare
  alice constant uuid := '00000000-0000-0000-0000-00000000000a';
begin
  assert (select display_name from public.profiles where id = alice) = 'Alice', 'имя по умолчанию из email';
  assert (select count(*) from public.search_people('ALI')) = 1, 'поиск по имени без учёта регистра';
  assert (select count(*) from public.search_people('%')) = 0, 'спецсимволы LIKE экранируются';
  assert (select is_following from public.search_people('alice')), 'Боб подписан на Алису';
  assert (select followers from public.profile_cards where id = alice)
         = (select count(*) from public.follows where followee_id = alice), 'счётчик подписчиков';
  assert (select plants from public.profile_cards where id = alice)
         = (select count(*) from public.plants where owner_id = alice and deleted_at is null),
         'в карточке — растения, видимые Бобу';
  assert (select count(*) from public.people_following(auth.uid())) >= 1, 'подписки Боба';
  assert auth.uid() in (select id from public.people_followers(alice)), 'Боб среди подписчиков Алисы';
  assert not exists (select 1 from public.search_people('') where is_me), 'в рекомендациях нет себя';
end $$;
update public.profiles set display_name = 'Боб', username = 'bob_garden' where id = auth.uid();
do $$ begin
  assert (select display_name || '/' || username from public.profiles where id = auth.uid()) = 'Боб/bob_garden',
         'своё имя и username меняются';
end $$;
do $$ begin
  update public.profiles set created_at = now() where id = auth.uid();
  raise exception 'дату регистрации менять нельзя';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  update public.profiles set display_name = 'Чужое имя' where id = '00000000-0000-0000-0000-00000000000a';
  assert (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 'Alice',
         'чужой профиль не меняется';
end $$;
-- Кэрол заблокирована Алисой — не находит её.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  assert (select count(*) from public.search_people('alice')) = 0, 'заблокированный не видит профиль';
end $$;

-- Растение в воде: график полива выключается и включается обратно.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update public.plants set in_water = true where id = '20000000-0000-0000-0000-000000000001';
do $$ begin
  assert (select enabled from public.care_schedules where id = '30000000-0000-0000-0000-000000000001') = false,
         'в воде — полив выключен';
  assert (select count(*) from public.care_due('2027-01-01') where type = 'water') = 0, 'и не в списке дел';
end $$;
insert into public.plants (id, nickname, in_water) values ('20000000-0000-0000-0000-000000000009', 'Черенок в стакане', true);
insert into public.care_schedules (plant_id, type, interval_days)
values ('20000000-0000-0000-0000-000000000009', 'water', 5);
do $$ begin
  assert (select enabled from public.care_schedules
           where plant_id = '20000000-0000-0000-0000-000000000009' and type = 'water') = false,
         'новый график полива для растения в воде создаётся выключенным';
end $$;
update public.plants set in_water = false where id = '20000000-0000-0000-0000-000000000001';
do $$ begin
  assert (select enabled from public.care_schedules where id = '30000000-0000-0000-0000-000000000001'),
         'из воды в грунт — полив снова включён';
end $$;

-- Push-уведомления: подписки, очередь по событиям и настройкам, напоминание об уходе.
select public.save_push_subscription('https://push.example/alice', 'p256-a', 'auth-a', 'test');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select public.save_push_subscription('https://push.example/bob', 'p256-b', 'auth-b', 'test');
do $$ begin
  assert (select count(*) from public.push_subscriptions) = 1, 'Боб видит только свою подписку';
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), 'https://push.example/x', 'x', 'x');
  raise exception 'подписка напрямую не добавляется';
exception when insufficient_privilege then null;
end $$;
insert into public.comments (post_id, text)
values ('40000000-0000-0000-0000-000000000003', 'Ещё проверьте, не холодно ли ему');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.messages (conversation_id, body)
values ((select id from public.conversations limit 1), 'Жду вас в субботу');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
update public.profiles set notify_messages = false where id = auth.uid();
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.messages (conversation_id, body)
values ((select id from public.conversations limit 1), 'Это уведомление Бобу не придёт');
update public.profiles set reminder_time = '00:00', timezone = 'Europe/Moscow' where id = auth.uid();
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  assert (select count(*) from public.push_subscriptions) = 0, 'чужие подписки не видны';
end $$;

reset role;
do $$
declare n int;
begin
  assert (select count(*) from private.push_queue
           where user_id = '00000000-0000-0000-0000-00000000000b' and url like '/messages/chat/%') = 1,
         'одно сообщение — одно уведомление, после отключения — ни одного';
  assert (select title from private.push_queue
           where user_id = '00000000-0000-0000-0000-00000000000a' and url like '/feed/question/%')
         = 'Новый ответ на ваш вопрос', 'автору вопроса — об ответе';
  n := private.enqueue_care_reminders();
  assert n = 1, format('напоминание об уходе Алисе: %s', n);
  assert private.enqueue_care_reminders() = 0, 'второй раз за день не напоминаем';
  assert (select count(*) from public.push_take_batch(100)) = 3, 'три уведомления к отправке';
  assert (select count(*) from private.push_queue where sent_at is null) = 0, 'очередь разобрана';
end $$;
set role authenticated;

-- Магазины: заявка на проверке, импорт каталога, проверка администратором, «Где купить»,
-- уведомление «подешевело» по «Хочу».
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.shops (name, inn, city, status) values ('Зелёный угол', '7707083893', 'Казань', 'verified');
do $$ begin
  assert (select status from public.shops where owner_id = auth.uid()) = 'pending', 'заявка всегда на проверке';
end $$;
-- ИНН необязателен (проверка временно отключена), но указанный — только 10 или 12 цифр.
update public.shops set inn = null where owner_id = auth.uid();
do $$ begin
  assert (select inn from public.shops where owner_id = auth.uid()) is null, 'ИНН необязателен';
  update public.shops set inn = '12345' where owner_id = auth.uid();
  raise exception 'ИНН не той длины принят';
exception when check_violation then null;
end $$;
update public.shops set inn = '7707083893' where owner_id = auth.uid();
update public.shops set delivery = true where owner_id = auth.uid();
select * from public.shop_import_products(jsonb_build_array(
  jsonb_build_object('external_id', 'M-1', 'title', 'Монстера 17/70', 'price_rub', 1500,
                     'species_id', (select id from public.species where slug = 'monstera-deliciosa')),
  jsonb_build_object('external_id', 'X-1', 'title', 'Кашпо', 'price_rub', 300)));
do $$ begin
  perform public.review_shop((select id from public.shops where owner_id = auth.uid()), 'verified');
  raise exception 'подтверждает только администратор';
exception when insufficient_privilege then null;
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into public.wishlist_items (species_id) values ((select id from public.species where slug = 'monstera-deliciosa'));
do $$ begin
  assert (select count(*) from public.shops) = 0, 'непроверенный магазин не виден';
  assert (select count(*) from public.shop_products) = 0, 'и его каталог';
end $$;
reset role;
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select public.review_shop((select id from public.shops limit 1), 'verified', 'Реквизиты проверены');
do $$ begin
  assert (select count(*) from public.where_to_buy((select id from public.species where slug = 'monstera-deliciosa'))) = 1,
         'где купить: одно предложение';
  assert (select price_rub from public.where_to_buy((select id from public.species where slug = 'monstera-deliciosa'), 'Москва')) = 1500,
         'из другого города — если есть доставка';
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select * from public.shop_import_products(jsonb_build_array(
  jsonb_build_object('external_id', 'M-1', 'title', 'Монстера 17/70', 'price_rub', 1200,
                     'species_id', (select id from public.species where slug = 'monstera-deliciosa'))), true);
do $$ begin
  assert (select count(*) from public.shop_products) = 1, 'замена каталога удаляет отсутствующие в файле';
end $$;
update public.shops set name = 'Зелёный угол и К' where owner_id = auth.uid();
do $$ begin
  assert (select status from public.shops where owner_id = auth.uid()) = 'pending', 'смена названия — снова на проверку';
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  assert (select count(*) from public.shops) = 0, 'заблокированный не видит магазин';
end $$;

reset role;
do $$ begin
  assert (select count(*) from private.push_queue
           where user_id = '00000000-0000-0000-0000-00000000000b' and title like 'Подешевело:%') = 1,
         'подписчику «Хочу» — уведомление о снижении цены';
  assert (select count(*) from private.push_queue
           where user_id = '00000000-0000-0000-0000-00000000000a' and title = 'Магазин подтверждён ✓') = 1,
         'владельцу — о проверке магазина';
end $$;
set role authenticated;

-- Ошибочная отметка ухода: удаление возвращает график как было.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare before_s public.care_schedules;
declare after_s public.care_schedules;
begin
  select * into before_s from public.care_schedules where id = '30000000-0000-0000-0000-000000000001';
  insert into public.care_events (id, plant_id, type, performed_at)
  values ('70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'water',
          coalesce(before_s.last_done_at, now() - interval '10 days') + interval '1 day');
  assert (select last_done_at from public.care_schedules where id = before_s.id) <> before_s.last_done_at,
         'отметка сдвинула график';
  delete from public.care_events where id = '70000000-0000-0000-0000-000000000001';
  select * into after_s from public.care_schedules where id = before_s.id;
  assert after_s.last_done_at is not distinct from before_s.last_done_at, 'удаление вернуло дату последнего полива';
  assert after_s.user_factor = before_s.user_factor, 'и коэффициент подстройки';
  assert after_s.next_due_at is not distinct from before_s.next_due_at, 'и дату следующего полива';
end $$;

-- Поиск по базе знаний (доступен и гостям).
set role anon;
set request.jwt.claim.sub = '';
do $$ begin
  assert (select slug from public.search_species('монстера') limit 1) = 'monstera-deliciosa',
         'поиск по русскому названию';
  assert (select slug from public.search_species('тёщин язык') limit 1) = 'dracaena-trifasciata',
         'поиск по народному названию';
  assert (select slug from public.search_species('sansevieria trifasciata') limit 1) = 'dracaena-trifasciata',
         'поиск по синониму';
  assert 'dracaena-trifasciata' in (select slug from public.search_species('sansevieria')),
         'поиск по роду-синониму';
  assert 'streptocarpus-ionanthus' in (select slug from public.search_species('фиалка')),
         'поиск по части народного названия';
  assert (select slug from public.search_species('fikus elastika') limit 1) = 'ficus-elastica',
         'поиск с опечатками';
  assert (select count(*) from public.species) >= 244, 'расширенная база знаний';
  assert (select count(*) from public.species s where not exists (
            select 1 from public.care_profiles c where c.species_id = s.id)) = 0,
         'у каждого вида есть карточка ухода';
  assert (select slug from public.search_species('калатея') limit 1) like 'goeppertia-%',
         'поиск по старому народному названию';
  assert (select slug from public.search_species('calathea orbifolia') limit 1) = 'goeppertia-orbifolia',
         'поиск по устаревшему латинскому названию';
  assert (select slug from public.search_species('узамбарская фиалка') limit 1) = 'streptocarpus-ionanthus',
         'сенполия под новым названием';
  assert (select count(*) from public.plants) = 0, 'гость не видит растения';
end $$;

-- Составы грунта (читают и гости).
do $$ begin
  assert (select count(*) from public.soil_mixes) >= 15, 'справочник грунтов заполнен';
  assert (select count(*) from public.care_profiles where soil_mix_slug is null) = 0,
         'у каждого вида назначен состав грунта';
  assert (select count(*) from public.soil_mixes m
           where (select coalesce(sum((c->>'pct')::int), 0)
                    from jsonb_array_elements(m.components) c) <> 100) = 0,
         'доли компонентов грунта в сумме дают 100%';
  assert (select count(*) from public.soil_mixes m, jsonb_array_elements(m.components) c
           where c->>'material' not in (
             'sod_soil', 'leaf_soil', 'peat', 'sphagnum_peat', 'coir', 'conifer_soil', 'humus', 'sand',
             'perlite', 'vermiculite', 'pumice', 'zeolite', 'akadama', 'lava', 'bark_fine', 'bark',
             'sphagnum', 'charcoal', 'clay_pebbles', 'gravel')
              or c->>'role' not in ('base', 'loosener', 'moisture', 'drainage', 'additive')) = 0,
         'в грунтах только известные сайту материалы и роли';
  assert (select count(*) from public.soil_mixes where ph_min > ph_max) = 0, 'pH: минимум не больше максимума';
  assert (select m.slug from public.care_profiles c
            join public.species s on s.id = c.species_id
            join public.soil_mixes m on m.slug = c.soil_mix_slug
           where s.slug = 'lithops-lesliei') = 'mesembs_mineral', 'литопсу — минеральный грунт';
end $$;

-- Правка и удаление места: свет меняет интервалы, удаление оставляет растение без места.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.locations (id, name, light_level)
values ('10000000-0000-0000-0000-0000000000f1', 'Балкон', 'bright_indirect');
insert into public.plants (id, nickname, species_id, location_id, pot_material)
values ('20000000-0000-0000-0000-0000000000f1', 'Фикус на балконе',
        (select id from public.species where slug = 'ficus-elastica'),
        '10000000-0000-0000-0000-0000000000f1', 'plastic');
insert into public.care_schedules (id, plant_id, type, interval_days, last_done_at)
values ('30000000-0000-0000-0000-0000000000f1', '20000000-0000-0000-0000-0000000000f1',
        'water', 7, '2026-07-01 00:00+00');
create temp table loc_due as
  select next_due_at from public.care_schedules where id = '30000000-0000-0000-0000-0000000000f1';
update public.locations set name = 'Лоджия', light_level = 'low' where id = '10000000-0000-0000-0000-0000000000f1';
do $$ begin
  assert (select next_due_at from public.care_schedules where id = '30000000-0000-0000-0000-0000000000f1')
       > (select next_due_at from loc_due), 'в тени поливать реже';
end $$;
truncate loc_due;
insert into loc_due select next_due_at from public.care_schedules where id = '30000000-0000-0000-0000-0000000000f1';
delete from public.locations where id = '10000000-0000-0000-0000-0000000000f1';
do $$ begin
  assert (select location_id from public.plants where id = '20000000-0000-0000-0000-0000000000f1') is null,
         'растение осталось без места';
  assert (select next_due_at from public.care_schedules where id = '30000000-0000-0000-0000-0000000000f1')
       <> (select next_due_at from loc_due), 'интервалы пересчитаны после удаления места';
end $$;
reset role;
set role anon;
set request.jwt.claim.sub = '';

do $$ begin
  perform private.can_view(gen_random_uuid(), 'public');
  raise exception 'гость не должен вызывать служебные функции';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform public.my_garden_stats();
  raise exception 'гость не должен получать статистику';
exception when insufficient_privilege then null;
end $$;

-- Удаление магазина: только владелец (или администратор), каталог — вместе с магазином.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into public.shops (name, city) values ('Магазин на удаление', 'Москва');
reset role;
insert into public.shop_products (shop_id, external_id, title, price_rub)
select id, 'del-1', 'Фикус', 500 from public.shops where name = 'Магазин на удаление';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
delete from public.shops where name = 'Магазин на удаление';
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert exists (select 1 from public.shops where owner_id = auth.uid()), 'чужой магазин не удалить';
end $$;
delete from public.shops where owner_id = auth.uid();
reset role;
do $$ begin
  assert not exists (select 1 from public.shops where name = 'Магазин на удаление'), 'владелец удалил магазин';
  assert not exists (select 1 from public.shop_products where external_id = 'del-1'), 'каталог удалён вместе с магазином';
end $$;
set role authenticated;

-- Советы команды (администратора) видны в «Подписках» даже тем, кто ни на кого не подписан.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into public.posts (kind, event, text) values ('milestone', 'tip', 'Совет команды');
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'newbie@example.com');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
do $$ begin
  assert exists (select 1 from public.feed_diaries('following') where text = 'Совет команды'), 'новичок видит советы команды';
end $$;

-- ---------------------------------------------------------------------------
-- Конкурсы: условия участия и честная жеребьёвка.
-- Дина проводит розыгрыш в Москве без доставки, участвуют Егор и Лев.
-- Хасан из Казани, у Вани (зарегистрировался вчера) пустой профиль и нет постов, у Яны нет растений — им нельзя.
-- ---------------------------------------------------------------------------
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'dina@example.com', '{}'),
  ('00000000-0000-0000-0000-0000000000d2', 'egor@example.com', '{}'),
  ('00000000-0000-0000-0000-0000000000d6', 'lev@example.com', '{}'),
  ('00000000-0000-0000-0000-0000000000d7', 'hasan@example.com', '{}'),
  ('00000000-0000-0000-0000-0000000000d8', 'vanya@example.com', '{}'),
  ('00000000-0000-0000-0000-0000000000d9', 'yana@example.com', '{}');

update public.profiles set created_at = now() - interval '30 days', city = 'Москва'
 where id::text like '00000000-0000-0000-0000-0000000000d%';
update public.profiles set city = 'Казань' where id = '00000000-0000-0000-0000-0000000000d7';
update public.profiles set created_at = now() - interval '1 day' where id = '00000000-0000-0000-0000-0000000000d8';
-- У остальных профиль заполнен (имя, город, пара слов о себе) — это условие участия.
update public.profiles set display_name = 'Садовод', bio = 'Люблю растения'
 where id::text like '00000000-0000-0000-0000-0000000000d%' and id <> '00000000-0000-0000-0000-0000000000d8';

-- У всех, кроме Яны, — растение со своим фото.
do $$
declare u uuid; pl uuid; ph uuid;
begin
  for u in select id from public.profiles
            where id::text like '00000000-0000-0000-0000-0000000000d%'
              and id <> '00000000-0000-0000-0000-0000000000d9' loop
    pl := gen_random_uuid(); ph := gen_random_uuid();
    insert into public.plants (id, owner_id, nickname) values (pl, u, 'Фикус');
    insert into public.plant_photos (id, plant_id, uploaded_by, storage_path) values (ph, pl, u, u || '/' || pl || '/p.jpg');
    update public.plants set cover_photo_id = ph where id = pl;
  end loop;
end $$;

do $$ begin
  -- Эталон совпадает с web/src/lib/domain/__tests__/contest.test.ts: браузер пересчитывает итог так же.
  assert private.draw_uniform('podokonnik-test-seed', '00000000-0000-0000-0000-0000000000d2') = 0.3729562971773789,
         'равномерное число из секрета — как в браузере';
end $$;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
insert into public.contests (id, title, prize, city, ends_at)
values ('60000000-0000-0000-0000-000000000001', 'Черенок монстеры', 'Укоренённый черенок', 'Москва', now() + interval '3 days');

do $$ begin
  assert (select not pinned and status = 'active' and seed is null and seed_hash ~ '^[0-9a-f]{64}$'
            from public.contests where id = '60000000-0000-0000-0000-000000000001'),
         'розыгрыш садовода не закреплён, секрет скрыт, хеш опубликован';
  begin
    insert into public.contests (title, prize, city, ends_at) values ('Второй', 'Приз', 'Москва', now() + interval '2 days');
    raise exception 'второй одновременный розыгрыш не должен создаваться';
  exception when check_violation then null;
  end;
  begin
    insert into public.contests (title, prize, city, ends_at) values ('Долгий', 'Приз', 'Москва', now() + interval '60 days');
    raise exception 'розыгрыш дольше 30 дней не должен создаваться';
  exception when check_violation then null;
  end;
  begin
    perform public.join_contest('60000000-0000-0000-0000-000000000001');
    raise exception 'организатор не участвует в своём розыгрыше';
  exception when check_violation then null;
  end;
  begin
    perform seed from private.contest_seeds;
    raise exception 'секрет не должен читаться из браузера';
  exception when insufficient_privilege then null;
  end;
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d2';
select public.join_contest('60000000-0000-0000-0000-000000000001');
select public.join_contest('60000000-0000-0000-0000-000000000001'); -- повтор ничего не ломает
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d6';
select public.join_contest('60000000-0000-0000-0000-000000000001');

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d7';
do $$ begin
  perform public.join_contest('60000000-0000-0000-0000-000000000001');
  raise exception 'без доставки участвуют только из того же города';
exception when check_violation then null;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d8';
do $$ begin
  perform public.join_contest('60000000-0000-0000-0000-000000000001');
  raise exception 'без профиля и публикаций не участвует';
exception when check_violation then null;
end $$;
-- С заполненным профилем участвует сразу, даже новый аккаунт (и может выйти).
update public.profiles set display_name = 'Ваня', bio = 'Люблю фикусы'
 where id = '00000000-0000-0000-0000-0000000000d8';
select public.join_contest('60000000-0000-0000-0000-000000000001');
do $$ begin
  assert exists (select 1 from public.contest_entries where contest_id = '60000000-0000-0000-0000-000000000001'
                   and user_id = '00000000-0000-0000-0000-0000000000d8'), 'заполненный профиль — участие сразу';
end $$;
select public.leave_contest('60000000-0000-0000-0000-000000000001');
-- После первой публикации — тоже сразу.
update public.profiles set bio = null where id = '00000000-0000-0000-0000-0000000000d8';
insert into public.posts (text) values ('Мой первый пост');
select public.join_contest('60000000-0000-0000-0000-000000000001');
select public.leave_contest('60000000-0000-0000-0000-000000000001');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d9';
do $$ begin
  perform public.join_contest('60000000-0000-0000-0000-000000000001');
  raise exception 'без растения со своим фото не участвуют';
exception when check_violation then null;
end $$;

do $$ begin
  assert (select count(*) from public.contest_participants('60000000-0000-0000-0000-000000000001')) = 2,
         'участники видны всем';
  begin
    perform public.cancel_contest('60000000-0000-0000-0000-000000000001');
    raise exception 'чужой розыгрыш не отменить';
  exception when check_violation then null;
  end;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
do $$ begin
  perform public.cancel_contest('60000000-0000-0000-0000-000000000001');
  raise exception 'розыгрыш с участниками организатор не отменяет';
exception when check_violation then null;
end $$;

-- Время вышло: итоги подводит сервер.
reset role;
update public.contests set ends_at = now() - interval '1 minute' where id = '60000000-0000-0000-0000-000000000001';
do $$
declare c public.contests; expected uuid;
begin
  assert private.finish_due_contests() = 1, 'подведён один розыгрыш';
  select * into c from public.contests where id = '60000000-0000-0000-0000-000000000001';
  assert c.status = 'finished' and c.seed is not null, 'итоги подведены, секрет раскрыт';
  assert encode(sha256(convert_to(c.seed, 'UTF8')), 'hex') = c.seed_hash, 'раскрытый секрет совпадает с опубликованным хешем';
  select user_id into expected from public.contest_entries
   where contest_id = c.id
   order by private.draw_uniform(c.seed, user_id) desc, user_id limit 1;
  assert (select user_id from public.contest_entries where contest_id = c.id and place = 1) = expected,
         'победитель — наибольшее u: шансы равны';
  assert (select count(*) from public.contest_entries where contest_id = c.id and place is not null) = 1, 'один победитель';
  assert exists (select 1 from public.conversations where contest_id = c.id and buyer_id = expected
                   and seller_id = '00000000-0000-0000-0000-0000000000d1'), 'чат победителя с организатором';
  assert private.finish_due_contests() = 0, 'повторно не подводится';
end $$;

-- Победитель видит чат с названием розыгрыша; присоединиться к закончившемуся нельзя.
set role authenticated;
select set_config('request.jwt.claim.sub', (select user_id::text from public.contest_entries where place = 1), false);
do $$ begin
  assert exists (select 1 from public.my_conversations() where listing_title = '🎉 Черенок монстеры'), 'чат розыгрыша в списке';
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d6';
do $$ begin
  perform public.leave_contest('60000000-0000-0000-0000-000000000001');
  assert (select count(*) from public.contest_entries where contest_id = '60000000-0000-0000-0000-000000000001') = 2,
         'после итогов выйти нельзя';
end $$;

-- Вручение: победитель подтверждает за 72 часа, иначе приз переходит следующему по очереди.
do $$ begin
  assert (select array_agg(rank order by rank) from public.contest_entries
           where contest_id = '60000000-0000-0000-0000-000000000001') = array[1, 2],
         'очередь жеребьёвки записана всем участникам';
end $$;
select set_config('request.jwt.claim.sub', (select user_id::text from public.contest_entries where rank = 2
  and contest_id = '60000000-0000-0000-0000-000000000001'), false);
do $$ begin
  perform public.claim_prize('60000000-0000-0000-0000-000000000001');
  raise exception 'не победитель не подтверждает приз';
exception when check_violation then null;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
do $$ begin
  perform public.mark_prize_delivered('60000000-0000-0000-0000-000000000001',
    (select user_id from public.contest_entries where rank = 1 and contest_id = '60000000-0000-0000-0000-000000000001'));
  raise exception 'вручить можно только после подтверждения';
exception when check_violation then null;
end $$;

-- Первый победитель молчит 72 часа.
reset role;
update public.contest_entries set claim_deadline = now() - interval '1 minute'
 where contest_id = '60000000-0000-0000-0000-000000000001' and rank = 1;
do $$ begin
  perform private.finish_due_contests();
  assert (select forfeited_at is not null and place is null from public.contest_entries
           where contest_id = '60000000-0000-0000-0000-000000000001' and rank = 1), 'молчавший теряет место';
  assert (select place = 1 and claim_deadline > now() from public.contest_entries
           where contest_id = '60000000-0000-0000-0000-000000000001' and rank = 2), 'место у следующего по очереди';
  assert exists (select 1 from public.conversations c join public.contest_entries e
                   on e.contest_id = c.contest_id and e.user_id = c.buyer_id
                  where c.contest_id = '60000000-0000-0000-0000-000000000001' and e.rank = 2),
         'у нового победителя чат с организатором';
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', (select user_id::text from public.contest_entries where rank = 1
  and contest_id = '60000000-0000-0000-0000-000000000001'), false);
do $$ begin
  perform public.claim_prize('60000000-0000-0000-0000-000000000001');
  raise exception 'потерявший место не подтверждает приз';
exception when check_violation then null;
end $$;
select set_config('request.jwt.claim.sub', (select user_id::text from public.contest_entries where rank = 2
  and contest_id = '60000000-0000-0000-0000-000000000001'), false);
select public.claim_prize('60000000-0000-0000-0000-000000000001');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select public.mark_prize_delivered('60000000-0000-0000-0000-000000000001',
  (select user_id from public.contest_entries where rank = 2 and contest_id = '60000000-0000-0000-0000-000000000001'));
do $$ begin
  assert (select claimed_at is not null and delivered_at is not null
            from public.contest_participants('60000000-0000-0000-0000-000000000001') where rank = 2),
         'приз подтверждён и вручён — видно в списке участников';
end $$;

-- Администратор: конкурсы закреплены, одновременно можно несколько, отменить может любой.
reset role;
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000000d6';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d6';
insert into public.contests (id, title, prize, city, delivery, ends_at) values
  ('60000000-0000-0000-0000-000000000002', 'Весенний розыгрыш', 'Набор грунтов', 'Москва', true, now() + interval '7 days'),
  ('60000000-0000-0000-0000-000000000003', 'Осенний розыгрыш', 'Горшок', 'Москва', true, now() + interval '7 days');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d7';
select public.join_contest('60000000-0000-0000-0000-000000000002'); -- с доставкой — из любого города
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d6';
select public.cancel_contest('60000000-0000-0000-0000-000000000002');
do $$ begin
  assert (select bool_and(pinned) from public.contests where organizer_id = '00000000-0000-0000-0000-0000000000d6'),
         'конкурсы администратора закреплены';
  assert (select status from public.contests where id = '60000000-0000-0000-0000-000000000002') = 'cancelled',
         'администратор отменяет розыгрыш с участниками';
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d7';
do $$ begin
  assert not exists (select 1 from public.contests where id = '60000000-0000-0000-0000-000000000002'),
         'отменённый розыгрыш виден только организатору и администратору';
end $$;

reset role;

-- Личные сообщения: «Написать» из профиля. У пары один чат, кто бы его ни начал; блокировка закрывает.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare d uuid;
begin
  d := public.start_direct('00000000-0000-0000-0000-00000000000b');
  assert (select direct from public.my_conversations() where id = d), 'личный чат помечен direct';
  assert (select listing_id from public.my_conversations() where id = d) is null, 'без объявления';
  insert into public.messages (conversation_id, body) values (d, 'Привет! Как ваша монстера?');
  begin
    perform public.start_direct(auth.uid());
    raise exception 'себе написать нельзя';
  exception when check_violation then null;
  end;
  begin
    perform public.start_direct('00000000-0000-0000-0000-00000000000c');
    raise exception 'заблокированному написать нельзя';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$
declare d uuid;
begin
  d := public.start_direct('00000000-0000-0000-0000-00000000000a');
  assert d = (select id from public.conversations where direct), 'у пары один личный чат';
  assert (select unread from public.my_conversations() where id = d), 'у собеседника непрочитанное';
  insert into public.messages (conversation_id, body) values (d, 'Отлично, выпустила новый лист!');
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  perform public.start_direct('00000000-0000-0000-0000-00000000000a');
  raise exception 'заблокированный не пишет тому, кто его заблокировал';
exception when insufficient_privilege then null;
end $$;
reset role;

-- Автомодерация: запрещённые темы не сохраняются; 3 попытки за сутки — пауза на 24 часа.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare d uuid := (select id from public.conversations where direct);
begin
  -- Обычные садовые разговоры проходят (похожие слова не мешают).
  insert into public.messages (conversation_id, body)
  values (d, 'Кокосовый субстрат и маковый рулет к чаю; фен для сушки корней не нужен, наркоз тоже.');
  begin
    insert into public.messages (conversation_id, body) values (d, 'Есть мефедрон?');
    raise exception 'запрещённая тема должна блокироваться';
  exception when sqlstate 'MOD01' then null;
  end;
  begin
    -- Латинские «двойники» и регистр не помогают.
    insert into public.messages (conversation_id, body) values (d, 'Как вырастить КОНОПЛЮ дома?');
    raise exception 'конопля должна блокироваться';
  exception when sqlstate 'MOD01' then null;
  end;
  begin
    insert into public.messages (conversation_id, body) values (d, 'псилоцuбиновые грибы');
    raise exception 'смешанная латиница должна блокироваться';
  exception when sqlstate 'MOD01' then null;
  end;
  begin
    insert into public.posts (text) values ('Продаю семена cannabis');
    raise exception 'посты тоже проверяются';
  exception when sqlstate 'MOD01' then null;
  end;
  -- Отчёт сайта: без запрещённого текста ничего не записывается.
  perform public.moderation_strike('Обычный текст', 'messages');
end $$;
reset role;
do $$ begin
  assert private.moderation_match('Монстера выпустила новый лист') is null, 'обычный текст не срабатывает';
  assert (select count(*) from private.moderation_strikes) = 0, 'ложный отчёт не записывается';
end $$;
set role authenticated;
select public.moderation_strike('Есть мефедрон?', 'messages');
select public.moderation_strike('Как вырастить коноплю?', 'messages');
select public.moderation_strike('кокаин', 'posts');
do $$ begin
  insert into public.messages (conversation_id, body)
  values ((select id from public.conversations where direct), 'Просто привет');
  raise exception 'после трёх попыток отправка на паузе';
exception when sqlstate 'MOD02' then null;
end $$;
reset role;
do $$ begin
  assert (select count(*) from private.moderation_strikes) = 3, 'три попытки записаны (без текста)';
  assert exists (select 1 from private.moderation_mutes
                  where user_id = '00000000-0000-0000-0000-00000000000a' and until > now() + interval '23 hours'),
         'пауза 24 часа';
end $$;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into public.messages (conversation_id, body)
values ((select id from public.conversations where direct), 'Собеседник пишет как обычно');
reset role;

-- Структура: одна разрешающая политика на действие (иначе Postgres вычисляет все сразу)
-- и индекс у каждого внешнего ключа (иначе удаление строки просматривает ссылающуюся таблицу).
do $$
declare dup text; fk text;
begin
  select string_agg(format('%s.%s: %s %s', schemaname, tablename, role, action), '; ') into dup
    from (select schemaname, tablename, role, action
            from (select schemaname, tablename, unnest(roles) as role,
                         unnest(case cmd when 'ALL' then array['SELECT','INSERT','UPDATE','DELETE'] else array[cmd] end) as action
                    from pg_policies
                   where schemaname in ('public', 'private') and permissive = 'PERMISSIVE') p
           group by schemaname, tablename, role, action
          having count(*) > 1) d;
  if dup is not null then raise exception 'несколько разрешающих политик на одно действие: %', dup; end if;

  select string_agg(format('%s (%s)', c.conname, c.conrelid::regclass), ', ') into fk
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
   where c.contype = 'f' and n.nspname in ('public', 'private')
     and not exists (
       select 1 from pg_index i
        where i.indrelid = c.conrelid
          and (string_to_array(i.indkey::text, ' ')::int2[])[1:cardinality(c.conkey)] @> c.conkey
          and (string_to_array(i.indkey::text, ' ')::int2[])[1:cardinality(c.conkey)] <@ c.conkey);
  if fk is not null then raise exception 'внешние ключи без индекса: %', fk; end if;
end $$;

\echo 'smoke test: OK'
