-- RLS без ролей: выполняется на SpaceWeb последним шагом переноса.
--
-- В Supabase запрос из браузера идёт от роли anon или authenticated, а security definer
-- функции работают от postgres, которого RLS не касается. На SpaceWeb роль одна —
-- владелец базы, от неё работает и PHP. Поэтому:
--   1. правила уже переписаны под auth.role() (export-policies.sql);
--   2. RLS включается принудительно (force) — владельца он тоже касается;
--   3. security definer функции на время работы получают признак пропуска (auth.rls_bypass(),
--      см. platform.sql), и для каждой таблицы с RLS есть правило rls_bypass, которое по нему
--      пропускает всё — как postgres в Supabase.

-- Пропуск для security definer функций и служебных заданий.
do $$
declare
  t record;
begin
  for t in
    select n.nspname, c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relrowsecurity and c.relkind in ('r', 'p')
      and n.nspname in ('public', 'private', 'storage')
  loop
    execute format($p$create policy rls_bypass on %I.%I as permissive for all to public
                      using (auth.rls_bypass()) with check (auth.rls_bypass())$p$, t.nspname, t.relname);
    execute format('alter table %I.%I force row level security', t.nspname, t.relname);
  end loop;
end
$$;

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.prosecdef and n.nspname in ('public', 'private')
  loop
    execute format('alter function %s set application_name = %L', f.sig, 'podokonnik-rls-bypass');
  end loop;
end
$$;
