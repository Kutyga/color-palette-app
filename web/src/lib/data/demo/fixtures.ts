/**
 * Вымышленные данные демо-режима: садоводы, записи, вопросы, объявления и магазины.
 */
import type { ListingKind } from "../../domain/market";
import type { DiaryEvent } from "../../domain/social";
import type { Profile } from "../repositories";

/** Вымышленные садоводы демо-режима: их можно найти, открыть профиль и растения, подписаться. */
export const DEMO_PEOPLE: {
  username: string;
  displayName: string;
  bio: string;
  followers: number;
  followsMe: boolean;
  plants: [string, string][];
}[] = [
  {
    username: "anna.green",
    displayName: "Анна",
    bio: "Ароидные и калатеи. Подоконники на север — и всё растёт.",
    followers: 1840,
    followsMe: false,
    plants: [
      ["Монстера Бублик", "monstera-deliciosa"],
      ["Калатея Ося", "goeppertia-orbifolia"],
      ["Сингониум", "syngonium-podophyllum"],
      ["Филодендрон Пинк", "philodendron-erubescens"],
    ],
  },
  {
    username: "fikus_papa",
    displayName: "Фикус Папа",
    bio: "Фикусы всех мастей. Роберт — мой первый.",
    followers: 932,
    followsMe: true,
    plants: [
      ["Роберт", "ficus-elastica"],
      ["Лира", "ficus-lyrata"],
      ["Бенджи", "ficus-benjamina"],
    ],
  },
  {
    username: "succulove",
    displayName: "Света | суккуленты",
    bio: "Кактусы, литопсы и немного терпения.",
    followers: 457,
    followsMe: true,
    plants: [
      ["Денежка", "crassula-ovata"],
      ["Камешки", "lithops-lesliei"],
      ["Алоэ", "aloe-vera"],
      ["Эхеверия", "echeveria-elegans"],
    ],
  },
  {
    username: "orchid.mood",
    displayName: "Оля и орхидеи",
    bio: "Фаленопсисы цветут третий раз подряд.",
    followers: 2110,
    followsMe: false,
    plants: [
      ["Луна", "phalaenopsis-hybrid"],
      ["Дендробиум", "dendrobium-nobile"],
    ],
  },
];

export const demoId = (username: string) => `demo-${username}`;

export const DEFAULT_PROFILE: Profile = { username: "gost", displayName: "Гость", bio: null, city: "Москва", isAdmin: false };

/** Записи дневников: автор, растение, вид, событие, текст, «поддержали». */
export const SAMPLE_DIARIES: [string, string, string, DiaryEvent, string, number][] = [
  [
    "anna.green",
    "Монстера Бублик",
    "monstera-deliciosa",
    "new_leaf",
    "Седьмой резной лист за лето. Секрет — опора из кокоса и терпение.",
    128,
  ],
  ["fikus_papa", "Роберт", "ficus-elastica", "progress", "Год назад был черенком в стакане. Теперь выше кота.", 93],
  ["succulove", "Денежка", "crassula-ovata", "repot", "Пересадила в терракоту на смесь для суккулентов с пемзой. Корни здоровые!", 45],
  ["orchid.mood", "Луна", "phalaenopsis-hybrid", "bloom", "Третье цветение подряд! Полив погружением раз в неделю.", 211],
];

/** Вопросы «Помощи»: автор, вид, текст, ответы [автор, текст], индекс лучшего ответа. */
export const SAMPLE_QUESTIONS: [string, string, string, [string, string][], number | null][] = [
  [
    "fikus_papa",
    "monstera-deliciosa",
    "У монстеры желтеют нижние листья, новые растут нормально. Поливаю раз в неделю. Что не так?",
    [
      ["anna.green", "Проверьте землю пальцем на 3–4 см: если там сыро — это перелив. Поливайте только после просыхания."],
      ["orchid.mood", "Ещё бывает, что старые листья просто отмирают — если желтеет 1 лист в месяц, это нормально."],
    ],
    0,
  ],
  [
    "succulove",
    "goeppertia-orbifolia",
    "Калатея сворачивает листья днём. Стоит в метре от окна на восток. Это от света или от воздуха?",
    [],
    null,
  ],
  [
    "orchid.mood",
    "phalaenopsis-hybrid",
    "После пересадки у фаленопсиса сморщились листья. Сколько ждать, пока отойдёт?",
    [["succulove", "Обычно 2–3 недели. Поставьте в тень и опрыскивайте воздух рядом, а не листья."]],
    null,
  ],
];

export const personOf = (userId: string) => DEMO_PEOPLE.find((d) => demoId(d.username) === userId);

/** Объявления демо-садоводов: автор, тип, вид, название, описание, цена, обмен на, город, доставка. */
export const SAMPLE_LISTINGS: [string, ListingKind, string, string, string, number | null, string | null, string, boolean][] = [
  [
    "anna.green",
    "sell",
    "monstera-deliciosa",
    "Укоренённая детка монстеры",
    "Три листа, уже с воздушными корнями. В горшке 9 см на ароидной смеси.",
    700,
    null,
    "Москва",
    false,
  ],
  [
    "succulove",
    "free",
    "kalanchoe-daigremontiana",
    "Детки каланхоэ Дегремона",
    "Отдам сколько нужно — растут сами. Возьмите свою баночку 🙂",
    null,
    null,
    "Москва",
    false,
  ],
  [
    "orchid.mood",
    "swap",
    "hoya-carnosa",
    "Черенки хойи мясистой",
    "Два черенка по 2 узла, укоренены в воде.",
    null,
    "На любую бегонию или строманту",
    "Казань",
    true,
  ],
  [
    "fikus_papa",
    "wanted",
    "stromanthe-thalia",
    "Ищу строманту «Триостар»",
    "Можно небольшую, готов забрать сам по Москве.",
    null,
    null,
    "Москва",
    false,
  ],
  [
    "anna.green",
    "sell",
    "begonia-maculata",
    "Бегония пятнистая, 30 см",
    "Пышная, цветёт. Отдаю из-за переезда. Горшок в подарок.",
    1500,
    null,
    "Москва",
    true,
  ],
];

export const AUTO_REPLY = "Здравствуйте! Да, ещё актуально 🌿 Когда вам удобно?";

/** Проверенные демо-магазины: название, ИНН, город, адрес, телефон, сайт, доставка, описание. */
export const SAMPLE_SHOPS: [string, string, string, string, string, string, boolean, string][] = [
  [
    "Зелёная комната",
    "7707083893",
    "Москва",
    "ул. Садовая, 12",
    "+7 495 123-45-67",
    "https://example.ru/green-room",
    true,
    "Тропические растения из питомников Голландии. Доставка по Москве и области.",
  ],
  [
    "Ботаника на Литейном",
    "7736207543",
    "Санкт-Петербург",
    "Литейный пр., 40",
    "+7 812 765-43-21",
    "https://example.ru/botanika",
    true,
    "Ароидные, калатеи и редкие сорта. Отправляем по всей России.",
  ],
];

/** Каталоги демо-магазинов: магазин, артикул, название, вид, цена, горшок, высота. */
export const SAMPLE_PRODUCTS: [number, string, string, string, number, number | null, number | null][] = [
  [0, "MON-17", "Монстера деликатесная 17/60", "monstera-deliciosa", 2490, 17, 60],
  [0, "MON-24", "Монстера деликатесная 24/100", "monstera-deliciosa", 4990, 24, 100],
  [0, "ZAM-17", "Замиокулькас 17/60", "zamioculcas-zamiifolia", 1890, 17, 60],
  [0, "SAN-14", "Сансевиерия трёхполосная Лаурентии", "dracaena-trifasciata", 1290, 14, 50],
  [0, "FIC-21", "Фикус эластика Робуста 21/90", "ficus-elastica", 3290, 21, 90],
  [0, "SPA-14", "Спатифиллум Свит Шико", "spathiphyllum-wallisii", 1190, 14, 45],
  [1, "B-MON-12", "Монстера деликатесная, молодое растение", "monstera-deliciosa", 1590, 12, 40],
  [1, "B-ORB-14", "Калатея орбифолия", "goeppertia-orbifolia", 2290, 14, 45],
  [1, "B-ALO-12", "Алоказия Зебрина", "alocasia-zebrina", 2790, 12, 50],
  [1, "B-HOY-10", "Хойя карноза, ампель", "hoya-carnosa", 990, 10, null],
  [1, "B-BEG-12", "Бегония макулата", "begonia-maculata", 1490, 12, 35],
];
