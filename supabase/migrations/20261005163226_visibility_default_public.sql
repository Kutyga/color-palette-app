-- Новые растения по умолчанию видны всем («Все»); «Подписчики» и «Только я» — по выбору.
-- У уже добавленных растений видимость не меняем: её выбирал владелец.
alter table public.plants alter column visibility set default 'public';
alter table public.profiles alter column default_visibility set default 'public';
