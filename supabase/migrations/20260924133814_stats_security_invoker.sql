-- Статистике не нужны повышенные права: она читает только собственные строки пользователя,
-- которые RLS и так ему открывает.
alter function public.my_garden_stats() security invoker;
