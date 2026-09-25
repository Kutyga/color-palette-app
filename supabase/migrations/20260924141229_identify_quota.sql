-- Распознавание через Pl@ntNet (Edge Function identify-plant).
-- Ключ хранится в Vault (секрет plantnet_api_key) и выдаётся только service_role.
-- Бесплатный тариф Pl@ntNet — 500 запросов в день, поэтому считаем квоты:
-- на пользователя и общую (строка с нулевым uuid).

create table if not exists private.identify_usage (
  user_id uuid not null,
  day     date not null default current_date,
  count   int  not null default 0,
  primary key (user_id, day)
);
alter table private.identify_usage enable row level security;

create or replace function public.consume_identify_quota(p_user uuid, p_user_limit int, p_total_limit int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  used_user int;
  used_total int;
begin
  insert into private.identify_usage (user_id, day, count) values (p_user, current_date, 1)
  on conflict (user_id, day) do update set count = private.identify_usage.count + 1
  returning count into used_user;

  insert into private.identify_usage (user_id, day, count)
  values ('00000000-0000-0000-0000-000000000000', current_date, 1)
  on conflict (user_id, day) do update set count = private.identify_usage.count + 1
  returning count into used_total;

  return used_user <= p_user_limit and used_total <= p_total_limit;
end;
$$;

create or replace function public.get_plantnet_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'plantnet_api_key';
$$;

revoke execute on function public.consume_identify_quota(uuid, int, int) from public, anon, authenticated;
revoke execute on function public.get_plantnet_key() from public, anon, authenticated;
grant execute on function public.consume_identify_quota(uuid, int, int) to service_role;
grant execute on function public.get_plantnet_key() to service_role;
