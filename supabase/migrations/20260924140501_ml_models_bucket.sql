-- Публичная папка для моделей распознавания, которые приложение скачивает на устройство.
-- Писать в неё может только service_role (политик на запись нет).
insert into storage.buckets (id, name, public)
values ('ml-models', 'ml-models', true)
on conflict (id) do nothing;
