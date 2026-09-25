-- Расписание сбора новостей: pg_cron раз в час вызывает Edge Function news-ingest через pg_net.
-- Секрет вызова генерируется здесь и хранится в Vault; функция сверяет его через
-- verify_news_ingest_secret (доступна только service_role).
-- Адрес проекта кладётся в Vault отдельно (он свой у каждого проекта):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');

create or replace function public.verify_news_ingest_secret(p_secret text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return p_secret is not null and exists (
    select 1 from vault.decrypted_secrets
     where name = 'news_ingest_secret' and decrypted_secret = p_secret);
end;
$$;

revoke execute on function public.verify_news_ingest_secret(text) from public, anon, authenticated;
grant execute on function public.verify_news_ingest_secret(text) to service_role;

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'news_ingest_secret',
                           'Секрет для вызова news-ingest по расписанию')
 where not exists (select 1 from vault.secrets where name = 'news_ingest_secret');

-- pg_cron и pg_net есть только на платформе Supabase; в локальной проверке шаг пропускается.
do $do$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron недоступен — расписание не создано';
    return;
  end if;
  create extension if not exists pg_net with schema extensions;
  create extension if not exists pg_cron;
  perform cron.schedule(
    'news-ingest-hourly',
    '17 * * * *',
    $cron$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/news-ingest',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'news_ingest_secret')),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
      );
    $cron$);
end
$do$;
