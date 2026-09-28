-- Выполняется на исходной базе (Supabase): печатает правила RLS схем public, private и storage
-- в виде для SpaceWeb, где ролей нет. Правило «to authenticated» становится «to public»
-- с условием auth.role() = 'authenticated' — смысл тот же, роль берётся из запроса.
-- Запуск: psql -XAt -f export-policies.sql.

\set QUIET on
\pset tuples_only on
\pset format unaligned

with p as (
  select *,
         'public' = any (roles) as for_all,
         format('(auth.role() = any (%L::text[]))', roles) as role_check
  from pg_policies
  where schemaname in ('public', 'private', 'storage')
),
parts as (
  select *,
         case
           when for_all then qual
           when permissive = 'RESTRICTIVE' then
             case when qual is not null then format('((not %s) or (%s))', role_check, qual) end
           when cmd = 'INSERT' then null
           when qual is not null then format('(%s and (%s))', role_check, qual)
           else role_check
         end as using_sql,
         case
           when for_all then with_check
           when permissive = 'RESTRICTIVE' then
             case when with_check is not null then format('((not %s) or (%s))', role_check, with_check) end
           when cmd = 'INSERT' then
             case when with_check is not null then format('(%s and (%s))', role_check, with_check) else role_check end
           when with_check is not null then format('(%s and (%s))', role_check, with_check)
         end as check_sql
  from p
)
select format('create policy %I on %I.%I as %s for %s to public%s%s;',
              policyname, schemaname, tablename, permissive, cmd,
              coalesce(' using ' || using_sql, ''), coalesce(' with check ' || check_sql, ''))
from parts
order by schemaname, tablename, policyname;
