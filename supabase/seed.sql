-- Стартовые данные базы знаний для разработки: 10 популярных комнатных растений.
-- Интервалы полива — ориентировочные для комнатных условий, в днях.

insert into public.families (latin_name, name_ru) values
  ('Araceae', 'Ароидные'),
  ('Moraceae', 'Тутовые'),
  ('Asparagaceae', 'Спаржевые'),
  ('Orchidaceae', 'Орхидные'),
  ('Asphodelaceae', 'Асфоделовые'),
  ('Crassulaceae', 'Толстянковые')
on conflict (latin_name) do nothing;

insert into public.genera (family_id, latin_name, name_ru)
select f.id, g.latin_name, g.name_ru
from (values
  ('Araceae', 'Monstera', 'Монстера'),
  ('Araceae', 'Spathiphyllum', 'Спатифиллум'),
  ('Araceae', 'Zamioculcas', 'Замиокулькас'),
  ('Araceae', 'Epipremnum', 'Эпипремнум'),
  ('Moraceae', 'Ficus', 'Фикус'),
  ('Asparagaceae', 'Dracaena', 'Драцена'),
  ('Asparagaceae', 'Chlorophytum', 'Хлорофитум'),
  ('Orchidaceae', 'Phalaenopsis', 'Фаленопсис'),
  ('Asphodelaceae', 'Aloe', 'Алоэ'),
  ('Crassulaceae', 'Crassula', 'Толстянка')
) as g(family, latin_name, name_ru)
join public.families f on f.latin_name = g.family
on conflict (latin_name) do nothing;

insert into public.species
  (genus_id, slug, latin_name, common_names, synonyms, description, plant_type,
   difficulty, toxic_to_pets, toxic_to_humans, air_purifying)
select g.id, s.slug, s.latin_name, s.common_names::jsonb, s.synonyms, s.description::jsonb,
       s.plant_type, s.difficulty, s.toxic_pets, s.toxic_humans, s.air_purifying
from (values
  ('Monstera', 'monstera-deliciosa', 'Monstera deliciosa',
   '{"ru": ["Монстера деликатесная", "Монстера"], "en": ["Swiss cheese plant"]}', '{}'::text[],
   '{"ru": "Крупная тропическая лиана с резными листьями."}', 'лиана', 2, true, true, true),
  ('Ficus', 'ficus-elastica', 'Ficus elastica',
   '{"ru": ["Фикус каучуконосный", "Фикус эластика"], "en": ["Rubber plant"]}', '{}',
   '{"ru": "Неприхотливое дерево с плотными глянцевыми листьями."}', 'дерево', 2, true, false, true),
  ('Dracaena', 'dracaena-trifasciata', 'Dracaena trifasciata',
   '{"ru": ["Сансевиерия", "Щучий хвост", "Тёщин язык"], "en": ["Snake plant"]}',
   '{"Sansevieria trifasciata"}',
   '{"ru": "Суккулентное растение, выносит тень и редкий полив."}', 'суккулент', 1, true, false, true),
  ('Spathiphyllum', 'spathiphyllum-wallisii', 'Spathiphyllum wallisii',
   '{"ru": ["Спатифиллум", "Женское счастье"], "en": ["Peace lily"]}', '{}',
   '{"ru": "Цветёт белыми покрывалами, любит влагу, сигнализирует о жажде поникшими листьями."}',
   'травянистое', 2, true, true, true),
  ('Zamioculcas', 'zamioculcas-zamiifolia', 'Zamioculcas zamiifolia',
   '{"ru": ["Замиокулькас", "Долларовое дерево"], "en": ["ZZ plant"]}', '{}',
   '{"ru": "Запасает воду в клубне, переносит засуху и полутень."}', 'травянистое', 1, true, true, false),
  ('Phalaenopsis', 'phalaenopsis-hybrid', 'Phalaenopsis × hybridus',
   '{"ru": ["Фаленопсис", "Орхидея-бабочка"], "en": ["Moth orchid"]}', '{}',
   '{"ru": "Эпифитная орхидея, растёт в коре, поливается погружением."}', 'эпифит', 3, false, false, false),
  ('Aloe', 'aloe-vera', 'Aloe vera',
   '{"ru": ["Алоэ вера", "Столетник"], "en": ["Aloe vera"]}', '{"Aloe barbadensis"}',
   '{"ru": "Лекарственный суккулент, любит солнце и редкий полив."}', 'суккулент', 1, true, false, false),
  ('Epipremnum', 'epipremnum-aureum', 'Epipremnum aureum',
   '{"ru": ["Эпипремнум золотистый", "Сциндапсус"], "en": ["Golden pothos"]}', '{"Scindapsus aureus"}',
   '{"ru": "Быстрорастущая ампельная лиана, легко укореняется в воде."}', 'лиана', 1, true, true, true),
  ('Chlorophytum', 'chlorophytum-comosum', 'Chlorophytum comosum',
   '{"ru": ["Хлорофитум хохлатый"], "en": ["Spider plant"]}', '{}',
   '{"ru": "Выносливое растение с «детками» на усах, безопасно для кошек."}', 'травянистое', 1, false, false, true),
  ('Crassula', 'crassula-ovata', 'Crassula ovata',
   '{"ru": ["Толстянка яйцевидная", "Денежное дерево"], "en": ["Jade plant"]}', '{}',
   '{"ru": "Суккулентное деревце, живёт десятилетиями."}', 'суккулент', 1, true, false, false)
) as s(genus, slug, latin_name, common_names, synonyms, description, plant_type,
       difficulty, toxic_pets, toxic_humans, air_purifying)
join public.genera g on g.latin_name = s.genus
on conflict (latin_name) do nothing;

insert into public.care_profiles
  (species_id, light, water_interval_summer, water_interval_winter, soil_dryness_before_watering,
   humidity_min_pct, temp_min_c, temp_max_c, fertilize_interval_days, fertilize_months,
   repot_every_years, propagation, tips)
select sp.id, c.light, c.summer, c.winter, c.dryness::jsonb, c.humidity, c.tmin, c.tmax,
       c.fert_days, c.fert_months, c.repot, c.propagation, c.tips::jsonb
from (values
  ('monstera-deliciosa', 'bright_indirect', 7, 12, '{"ru": "верхние 3–5 см"}', 50, 16, 30, 14,
   '{4,5,6,7,8,9}'::smallint[], 2, '{черенки,отводки}'::text[],
   '{"ru": ["Установите опору из кокосового волокна", "Протирайте листья от пыли"]}'),
  ('ficus-elastica', 'bright_indirect', 7, 14, '{"ru": "верхние 2–3 см"}', 40, 15, 30, 14,
   '{4,5,6,7,8,9}', 2, '{черенки,"воздушные отводки"}',
   '{"ru": ["Не переставляйте с места на место — сбрасывает листья"]}'),
  ('dracaena-trifasciata', 'medium', 14, 30, '{"ru": "полностью"}', 20, 12, 32, 30,
   '{5,6,7,8}', 3, '{деление,"листовые черенки"}',
   '{"ru": ["Лучше недолить, чем перелить", "Не лейте в розетку листьев"]}'),
  ('spathiphyllum-wallisii', 'medium', 4, 7, '{"ru": "верхние 1–2 см"}', 50, 16, 28, 14,
   '{3,4,5,6,7,8,9}', 1, '{деление}',
   '{"ru": ["Поникшие листья — сигнал к поливу", "Любит опрыскивание"]}'),
  ('zamioculcas-zamiifolia', 'medium', 14, 28, '{"ru": "полностью"}', 20, 15, 30, 30,
   '{5,6,7,8}', 3, '{деление,"листовые черенки"}',
   '{"ru": ["Перелив губителен для клубня"]}'),
  ('phalaenopsis-hybrid', 'bright_indirect', 7, 12, '{"ru": "корни серебристые, кора сухая"}', 50,
   18, 28, 14, '{3,4,5,6,7,8,9,10}', 2, '{детки}',
   '{"ru": ["Поливайте погружением на 15 минут", "Не оставляйте воду в пазухах листьев"]}'),
  ('aloe-vera', 'direct', 14, 30, '{"ru": "полностью"}', 20, 10, 32, 30,
   '{5,6,7,8}', 2, '{детки}',
   '{"ru": ["Нужен кактусовый грунт с дренажём"]}'),
  ('epipremnum-aureum', 'medium', 7, 12, '{"ru": "верхние 2–3 см"}', 40, 15, 30, 14,
   '{4,5,6,7,8,9}', 2, '{черенки}',
   '{"ru": ["Прищипывайте для кустистости"]}'),
  ('chlorophytum-comosum', 'bright_indirect', 5, 10, '{"ru": "верхние 2 см"}', 40, 12, 28, 14,
   '{4,5,6,7,8,9}', 1, '{детки,деление}',
   '{"ru": ["Коричневые кончики — сухой воздух или фтор в воде"]}'),
  ('crassula-ovata', 'direct', 12, 30, '{"ru": "полностью"}', 20, 10, 30, 30,
   '{5,6,7,8}', 3, '{черенки,листья}',
   '{"ru": ["Зимой держите в прохладе +10–15 °C"]}')
) as c(slug, light, summer, winter, dryness, humidity, tmin, tmax, fert_days, fert_months,
       repot, propagation, tips)
join public.species sp on sp.slug = c.slug
on conflict (species_id) do nothing;

-- Источники новостей. Адреса лент проверяйте перед запуском: неработающая лента
-- не ломает сбор, а пишет причину в news_sources.last_error.
insert into public.news_sources (name, feed_url, site_url, language, filter_keywords) values
  ('Ботаничка',        'https://www.botanichka.ru/feed/',                            'https://www.botanichka.ru',   'ru', false),
  ('ScienceDaily: Botany', 'https://www.sciencedaily.com/rss/plants_animals/botany.xml', 'https://www.sciencedaily.com', 'en', false),
  ('Phys.org: Plants & Animals', 'https://phys.org/rss-feed/biology-news/plants-animals/', 'https://phys.org', 'en', true),
  ('Gardening Know How', 'https://www.gardeningknowhow.com/feed',                    'https://www.gardeningknowhow.com', 'en', false)
on conflict (feed_url) do nothing;
