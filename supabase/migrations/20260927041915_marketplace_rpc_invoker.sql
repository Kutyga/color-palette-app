-- Как и остальные помощники: функции с правами владельца живут в private (не видны через
-- Data API), а наружу торчат обёртки с правами вызывающего.

alter function public.start_conversation(uuid) set schema private;
alter function public.mark_conversation_read(uuid) set schema private;

create or replace function public.start_conversation(p_listing uuid)
returns uuid
language sql
security invoker
set search_path = public
as $$
  select private.start_conversation(p_listing);
$$;

create or replace function public.mark_conversation_read(p_conversation uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  select private.mark_conversation_read(p_conversation);
$$;

revoke execute on function
  public.start_conversation(uuid),
  public.mark_conversation_read(uuid)
from public, anon;
grant execute on function
  public.start_conversation(uuid),
  public.mark_conversation_read(uuid)
to authenticated;
