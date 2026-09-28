-- Проверка базы SpaceWeb после переноса — на любых данных, ничего не меняет.
-- Запускается последним шагом migrate.sh.

\set ON_ERROR_STOP 1
begin;
do $$
declare
  bad text;
begin
  select string_agg(format('%I.%I', n.nspname, c.relname), ', ') into bad
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where c.relrowsecurity and c.relkind in ('r', 'p') and n.nspname in ('public', 'private', 'storage')
     and (not c.relforcerowsecurity
          or not exists (select 1 from pg_policies p
                          where p.schemaname = n.nspname and p.tablename = c.relname and p.policyname = 'rls_bypass'));
  if bad is not null then raise exception 'RLS не принудительный или нет rls_bypass: %', bad; end if;

  select string_agg(format('%s.%s', tablename, policyname), ', ') into bad
    from pg_policies where schemaname in ('public', 'private', 'storage') and roles <> '{public}';
  if bad is not null then raise exception 'правила с ролями, которых на SpaceWeb нет: %', bad; end if;

  select string_agg(p.oid::regprocedure::text, ', ') into bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where p.prosecdef and n.nspname in ('public', 'private')
     and not coalesce('application_name=podokonnik-rls-bypass' = any (p.proconfig), false);
  if bad is not null then raise exception 'security definer без пропуска: %', bad; end if;

  -- Как анонимный посетитель: справочник открыт, чужие данные закрыты.
  perform set_config('request.jwt.claims', '{}', true);
  if (select count(*) from public.species) = 0 then raise exception 'аноним не видит справочник видов'; end if;
  if (select count(*) from public.plants where visibility <> 'public') > 0 then
    raise exception 'аноним видит закрытые растения';
  end if;

  -- Профили считаем с пропуском: у анонима к ним доступа нет.
  perform set_config('application_name', 'podokonnik-rls-bypass', true);
  select string_agg(u.email, ', ') into bad
    from auth.users u where u.deleted_at is null and not exists (select 1 from public.profiles p where p.id = u.id);
  if bad is not null then raise exception 'пользователи без профиля: %', bad; end if;
end $$;
rollback;
\echo 'verify: OK'
