-- Проверка ИНН временно отключена: магазин может не указывать ИНН. Указанный ИНН по-прежнему
-- должен быть из 10 или 12 цифр (check-ограничение на колонке пропускает null).
-- Вернуть обязательность: alter table public.shops alter column inn set not null;
alter table public.shops alter column inn drop not null;
