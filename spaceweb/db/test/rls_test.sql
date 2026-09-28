-- Проверка перенесённой базы на SpaceWeb: правила доступа работают без ролей так же, как в
-- Supabase. Выполняется от владельца базы — как PHP. Все изменения откатываются.
-- Данные — из дымового теста supabase/tests/smoke_test.sql (Алиса, Боб, Кэрол).

\set ON_ERROR_STOP 1
begin;

-- Кто спрашивает — задаёт PHP настройками транзакции.
create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
                    case when uid is null then '{}' else json_build_object('sub', uid, 'role', 'authenticated')::text end,
                    true)
$$;

do $$
declare
  alice constant uuid := '00000000-0000-0000-0000-00000000000a';
  bob   constant uuid := '00000000-0000-0000-0000-00000000000b';
  n     int;
begin
  -- Владелец без пропуска подчиняется RLS, как и все.
  assert (select relforcerowsecurity from pg_class where oid = 'public.plants'::regclass), 'RLS для plants принудительный';

  -- Аноним: база знаний открыта, чужие закрытые растения — нет.
  perform pg_temp.act_as(null);
  assert auth.role() = 'anon', 'без входа — anon';
  assert (select count(*) from public.species) > 0, 'аноним видит справочник видов';
  assert (select count(*) from public.plants where visibility <> 'public') = 0, 'аноним не видит закрытые растения';

  -- Алиса видит свои растения.
  perform pg_temp.act_as(alice);
  assert auth.uid() = alice and auth.role() = 'authenticated', 'Алиса вошла';
  select count(*) into n from public.plants where owner_id = alice;
  assert n > 0, 'Алиса видит свои растения';

  -- Боб не может записать растение от имени Алисы.
  perform pg_temp.act_as(bob);
  begin
    insert into public.plants (owner_id, nickname) values (alice, 'чужое');
    raise exception 'Боб записал растение Алисы';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.plants where owner_id = alice and visibility = 'private') = 0,
         'Боб не видит закрытые растения Алисы';

  -- Security definer функция работает с пропуском: поиск людей видит все профили.
  assert (select count(*) from public.search_people('alice', 5)) >= 1, 'поиск людей через security definer';
  assert not auth.rls_bypass(), 'после функции пропуск снят';

  -- С пропуском (служебные задания PHP) видно всё.
  perform set_config('application_name', 'podokonnik-rls-bypass', true);
  assert (select count(*) from public.plants) >= (select count(*) from public.plants where owner_id = alice), 'пропуск';
  perform set_config('application_name', 'rls-test', true);

  -- Регистрация: триггер на auth.users создаёт профиль (security definer).
  perform pg_temp.act_as(null);
  insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000ff', 'new@example.com');
  perform set_config('application_name', 'podokonnik-rls-bypass', true);
  assert exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-0000000000ff'), 'профиль при регистрации';
  perform set_config('application_name', 'rls-test', true);

  -- Пароли перенесены в bcrypt без изменений.
  assert (select encrypted_password = extensions.crypt('test-password', encrypted_password)
            from auth.users where id = alice), 'пароль Алисы подходит';

  -- Права API перенесены: что можно из браузера.
  assert exists (select 1 from api.table_privileges where role = 'authenticated' and relation = 'plants' and privilege = 'SELECT'),
         'authenticated читает plants';
  assert exists (select 1 from api.column_privileges where role = 'authenticated' and relation = 'profiles' and privilege = 'UPDATE'),
         'колоночные права на обновление профиля';
  assert exists (select 1 from api.routine_privileges where role = 'authenticated' and routine = 'search_people'),
         'authenticated вызывает search_people';
  assert not exists (select 1 from api.routine_privileges where routine = 'ingest_news'),
         'служебные функции браузеру недоступны';
end $$;

rollback;
\echo 'rls test: OK'
