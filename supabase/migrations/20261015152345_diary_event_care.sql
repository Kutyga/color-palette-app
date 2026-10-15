-- Событие дневника «Уход»: душ, новая подсветка, обработка — часто сразу для нескольких растений.
alter table public.posts drop constraint posts_event_check;
alter table public.posts add constraint posts_event_check
  check (event in ('new_leaf', 'bloom', 'repot', 'cutting', 'rescue', 'progress', 'tip', 'care'));
