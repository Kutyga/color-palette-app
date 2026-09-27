-- Ключ Google Gemini для осмотра растения по фото (функция identify-plant, режим diseases).
-- Сам ключ кладётся в Vault вручную (vault.create_secret(..., 'gemini_api_key')), в репозитории его нет.
create or replace function public.get_gemini_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'gemini_api_key';
$$;

revoke execute on function public.get_gemini_key() from public, anon, authenticated;
grant execute on function public.get_gemini_key() to service_role;
