-- Автомодерация: сообщения, публикации, комментарии, объявления, розыгрыши и профиль не
-- сохраняются, если в тексте наркотики и растения, выращивать которые запрещено (ст. 228–231 УК РФ).
-- Проверяет база (обойти из браузера нельзя); список шаблонов — private.moderation_patterns,
-- его можно дополнять SQL-запросом без выкладки.
--
-- Политика:
--   • текст с запрещённой темой не сохраняется, автор видит спокойное объяснение (код MOD01);
--   • сайт сообщает о такой попытке (moderation_strike) — сохраняется только что сработало, без текста;
--   • 3 попытки за сутки — отправка всего нового на 24 часа закрыта (код MOD02);
--   • никому, кроме автора, ничего не показывается и не приходит.
-- Разбор: select * from private.moderation_strikes / private.moderation_mutes (администратор, SQL).

create table private.moderation_patterns (
  pattern text primary key,
  note    text not null
);

create table private.moderation_strikes (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  source     text not null,
  pattern    text not null,
  created_at timestamptz not null default now()
);
create index moderation_strikes_user_idx on private.moderation_strikes (user_id, created_at);

create table private.moderation_mutes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  until   timestamptz not null
);

alter table private.moderation_patterns enable row level security;
alter table private.moderation_strikes enable row level security;
alter table private.moderation_mutes enable row level security;
revoke all on private.moderation_patterns, private.moderation_strikes, private.moderation_mutes
  from public, anon, authenticated;

-- \m — начало слова, \M — конец. Шаблоны проверяются по тексту в нижнем регистре, с ё → е,
-- без невидимых символов, а также по варианту, где латинские и цифровые «двойники» (a, o, c, p, u, 0, 3…) заменены кириллицей.
insert into private.moderation_patterns (pattern, note) values
  ('\mнарко(т|ман|дил|шоп|бизнес)', 'наркотики'),
  ('\mмефедрон', 'мефедрон'), ('\mмефа?\M', 'мефедрон, сленг'),
  ('\mкокаин', 'кокаин'), ('\mгероин', 'героин'),
  ('\mамфетамин', 'амфетамин'), ('\mметамфетамин', 'метамфетамин'), ('\mамфа?\M', 'амфетамин, сленг'),
  ('\mгашиш', 'гашиш'), ('\mгаш\M', 'гашиш, сленг'),
  ('\mмарихуан', 'марихуана'), ('\mканнабис', 'каннабис'), ('\mконопл', 'конопля'),
  ('\mганджа', 'марихуана, сленг'), ('\mганджубас', 'марихуана, сленг'), ('\mшмал[ьи]', 'марихуана, сленг'),
  ('\mспайс', 'синтетические каннабиноиды'),
  ('\mлсд\M', 'ЛСД'), ('\mэкстази', 'экстази'), ('\mмдма\M', 'MDMA'),
  ('\mпсилоциб', 'псилоцибин, грибы'), ('\mгаллюциноген', 'галлюциногены'),
  ('\mкетамин', 'кетамин'), ('\mметадон', 'метадон'), ('\mопиум', 'опий'), ('\mопий\M', 'опий'),
  ('\mмескалин', 'мескалин'), ('\mпейот', 'пейот'), ('\mлофофор', 'лофофора (содержит мескалин)'),
  ('\mкратом', 'кратом'), ('шалфей предсказателей', 'сальвия дивинорум'), ('\mсальви[яи] дивинорум', 'сальвия дивинорум'),
  ('\mснотворн\w* мак', 'опийный мак'), ('\mопийн\w* мак', 'опийный мак'), ('\mмаков\w* солом', 'маковая солома'),
  ('\mлист\w* коки\M', 'кокаиновый куст'), ('\mкокаинов\w* куст', 'кокаиновый куст'),
  ('\mзакладчик', 'сбыт'), ('\mкладмен', 'сбыт'), ('\mкладчик', 'сбыт'),
  ('\mcocaine', 'кокаин'), ('\mheroin', 'героин'), ('\mcannabis', 'каннабис'), ('\mmarijuana', 'марихуана'),
  ('\mmephedrone', 'мефедрон'), ('\mamphetamine', 'амфетамин'), ('\mmethamphetamine', 'метамфетамин'),
  ('\mketamine', 'кетамин'), ('\mpsilocyb', 'псилоцибин'), ('\mmescaline', 'мескалин'), ('\mpeyote', 'пейот'),
  ('\mlophophora', 'лофофора'), ('\mkratom', 'кратом'), ('\mmdma\M', 'MDMA'), ('\mlsd\M', 'ЛСД'),
  ('\mhashish', 'гашиш'), ('\mganja', 'марихуана'), ('somniferum', 'опийный мак'), ('\msalvia divinorum', 'сальвия дивинорум');

-- Какой шаблон сработал (или null). Вызывается из триггеров и moderation_strike.
create or replace function private.moderation_match(p_text text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n text;
  c text;
  hit text;
begin
  if p_text is null or btrim(p_text) = '' then
    return null;
  end if;
  n := translate(lower(p_text), 'ё' || chr(173) || chr(8203) || chr(8204) || chr(8205) || chr(8288) || chr(65279), 'е');
  c := translate(n, 'aeopcxykmthbunr036', 'аеорсхукмтнвипгозб');
  select m.pattern into hit
    from private.moderation_patterns m
   where n ~ m.pattern or c ~ m.pattern
   limit 1;
  return hit;
end;
$$;

-- Триггер: проверить текстовые поля (имена — в аргументах триггера). Без входа (сервис,
-- администратор через SQL, служебные задачи) не проверяем. При правке — только если текст изменился.
create or replace function private.moderate_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  col text;
  txt text := '';
  changed boolean := tg_op = 'INSERT';
  muted timestamptz;
  tz text;
begin
  if me is null then
    return new;
  end if;
  foreach col in array tg_argv loop
    txt := txt || ' ' || coalesce(to_jsonb(new) ->> col, '');
    if tg_op = 'UPDATE' and (to_jsonb(new) ->> col) is distinct from (to_jsonb(old) ->> col) then
      changed := true;
    end if;
  end loop;
  if not changed then
    return new;
  end if;
  select m.until into muted from private.moderation_mutes m where m.user_id = me and m.until > now();
  if muted is not null then
    select coalesce(p.timezone, 'Europe/Moscow') into tz from public.profiles p where p.id = me;
    raise exception 'Отправка временно ограничена до % — из-за сообщений на запрещённые темы',
      to_char(muted at time zone coalesce(tz, 'Europe/Moscow'), 'DD.MM HH24:MI')
      using errcode = 'MOD02';
  end if;
  if private.moderation_match(txt) is not null then
    raise exception 'Не отправлено: на «Подоконнике» нельзя обсуждать наркотики, запрещённые вещества и растения, выращивать которые запрещено законом'
      using errcode = 'MOD01';
  end if;
  return new;
end;
$$;

create trigger moderate_messages before insert or update on public.messages
  for each row execute function private.moderate_row('body');
create trigger moderate_posts before insert or update on public.posts
  for each row execute function private.moderate_row('text');
create trigger moderate_comments before insert or update on public.comments
  for each row execute function private.moderate_row('text');
create trigger moderate_listings before insert or update on public.listings
  for each row execute function private.moderate_row('title', 'description', 'swap_for');
create trigger moderate_contests before insert or update on public.contests
  for each row execute function private.moderate_row('title', 'prize', 'description');
create trigger moderate_profiles before update on public.profiles
  for each row execute function private.moderate_row('display_name', 'bio', 'city');

-- Сайт сообщает об отклонённом тексте. База сама проверяет, что текст действительно запрещённый,
-- и хранит только сработавший шаблон. 3 попытки за сутки — пауза на 24 часа.
create or replace function private.moderation_strike(p_text text, p_source text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  hit text := private.moderation_match(p_text);
begin
  if me is null or hit is null then
    return;
  end if;
  insert into private.moderation_strikes (user_id, source, pattern)
  values (me, left(coalesce(p_source, '?'), 20), hit);
  if (select count(*) from private.moderation_strikes s
       where s.user_id = me and s.created_at > now() - interval '24 hours') >= 3 then
    insert into private.moderation_mutes (user_id, until) values (me, now() + interval '24 hours')
    on conflict (user_id) do update set until = greatest(private.moderation_mutes.until, excluded.until);
  end if;
end;
$$;

create or replace function public.moderation_strike(p_text text, p_source text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.moderation_strike(p_text, p_source);
$$;

revoke execute on function private.moderation_match(text), private.moderate_row() from public, anon, authenticated;
revoke execute on function public.moderation_strike(text, text), private.moderation_strike(text, text) from public, anon;
grant execute on function public.moderation_strike(text, text), private.moderation_strike(text, text) to authenticated;
