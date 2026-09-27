/**
 * «Что с растением?»: справочник симптомов → вероятные причины и что делать. Работает без сети
 * и для любых комнатных растений. Распознавание болезней по фото (Pl@ntNet) — дополнение:
 * у него ограниченный список видов и болезней.
 */

export const SYMPTOM_GROUPS = {
  leaves: "Листья",
  stem: "Стебель, корни, земля",
  pests: "Кто-то завёлся",
  growth: "Рост",
} as const;
export type SymptomGroup = keyof typeof SYMPTOM_GROUPS;

export interface Symptom {
  id: string;
  group: SymptomGroup;
  label: string;
}

export const SYMPTOMS: Symptom[] = [
  { id: "yellow_lower", group: "leaves", label: "Желтеют нижние листья" },
  { id: "yellow_many", group: "leaves", label: "Желтеют и мягкие многие листья" },
  { id: "brown_tips", group: "leaves", label: "Сухие коричневые кончики и края" },
  { id: "spots_halo", group: "leaves", label: "Бурые пятна с жёлтым ободком" },
  { id: "white_powder", group: "leaves", label: "Белый мучнистый налёт" },
  { id: "pale_patches", group: "leaves", label: "Выцветшие или обожжённые пятна со стороны окна" },
  { id: "drooping", group: "leaves", label: "Листья повисли, потеряли упругость" },
  { id: "leaf_drop", group: "leaves", label: "Сбрасывает листья" },
  { id: "curling", group: "leaves", label: "Листья скручиваются" },
  { id: "soil_wet", group: "stem", label: "Земля долго остаётся мокрой" },
  { id: "soil_dry", group: "stem", label: "Земля пересохла, отходит от стенок горшка" },
  { id: "stem_black", group: "stem", label: "Основание стебля темнеет и размягчается" },
  { id: "bad_smell", group: "stem", label: "Неприятный запах от земли" },
  { id: "grey_fluff", group: "stem", label: "Серый пушистый налёт" },
  { id: "webs", group: "pests", label: "Тонкая паутинка, мелкие светлые точки на листьях" },
  { id: "sticky", group: "pests", label: "Липкие листья или капли" },
  { id: "white_cotton", group: "pests", label: "Белые ватные комочки в пазухах" },
  { id: "brown_bumps", group: "pests", label: "Коричневые бугорки на стеблях и жилках" },
  { id: "silver_streaks", group: "pests", label: "Серебристые штрихи и чёрные точки" },
  { id: "gnats", group: "pests", label: "Мелкие мошки над землёй" },
  { id: "leggy", group: "growth", label: "Вытягивается, новые листья мельче и бледнее" },
  { id: "no_growth", group: "growth", label: "Давно не растёт" },
];

export interface Cause {
  id: string;
  title: string;
  /** Как понять, что это оно. */
  about: string;
  /** Что делать — по шагам. */
  steps: string[];
  /** Насколько срочно: 3 — действовать сегодня. */
  urgency: 1 | 2 | 3;
  /** Симптомы причины; первый — главный, самый характерный признак. */
  symptoms: string[];
}

export const CAUSES: Cause[] = [
  {
    id: "overwatering",
    title: "Перелив",
    about: "Корням не хватает воздуха, когда земля не просыхает. Самая частая причина проблем у комнатных растений.",
    steps: [
      "Не поливайте, пока не просохнет верхняя треть земли — проверьте пальцем.",
      "Слейте воду из поддона через 15 минут после полива.",
      "Проверьте дренажное отверстие; в тяжёлой земле — пересадите в более рыхлую смесь.",
    ],
    urgency: 2,
    symptoms: ["yellow_many", "soil_wet", "drooping", "gnats", "leaf_drop"],
  },
  {
    id: "root_rot",
    title: "Корневая гниль",
    about: "Следствие долгого перелива: корни темнеют, становятся мягкими и пахнут.",
    steps: [
      "Выньте растение из горшка и осмотрите корни: здоровые — светлые и упругие.",
      "Обрежьте всё тёмное и мягкое чистыми ножницами, срезы присыпьте углём.",
      "Пересадите в свежую сухую землю и чистый горшок, первый полив — через несколько дней.",
      "Если сгнило почти всё — укорените здоровый черенок.",
    ],
    urgency: 3,
    symptoms: ["stem_black", "bad_smell", "soil_wet", "drooping", "yellow_many"],
  },
  {
    id: "underwatering",
    title: "Недолив",
    about: "Земля пересохла, растение экономит воду: листья вянут и сохнут с краёв.",
    steps: [
      "Полейте до стока из дренажа; пересохший ком лучше замочить в тазу на 20–30 минут.",
      "Поливайте, как только просохнет верхний слой — напоминания подстроятся под ваши отметки.",
    ],
    urgency: 2,
    symptoms: ["soil_dry", "drooping", "brown_tips", "curling", "yellow_lower"],
  },
  {
    id: "dry_air",
    title: "Сухой воздух",
    about: "Зимой у батарей влажность падает до 20–30 %, а тропическим растениям нужно 50 % и больше.",
    steps: [
      "Отодвиньте растение от батареи или прикройте её.",
      "Поставьте рядом увлажнитель или поддон с мокрым керамзитом.",
      "Опрыскивание помогает ненадолго — увлажнитель надёжнее.",
    ],
    urgency: 1,
    symptoms: ["brown_tips", "curling", "webs"],
  },
  {
    id: "low_light",
    title: "Мало света",
    about: "Растение тянется к окну, новые листья мельче, у пёстрых сортов пропадает рисунок.",
    steps: [
      "Переставьте ближе к окну или на более светлое место — поменяйте место растения в приложении.",
      "Зимой помогает фитолампа 10–12 часов в день.",
      "Поливайте реже: в тени растение пьёт меньше.",
    ],
    urgency: 1,
    symptoms: ["leggy", "no_growth", "yellow_lower", "leaf_drop"],
  },
  {
    id: "sunburn",
    title: "Солнечный ожог",
    about: "Прямое солнце через стекло обжигает листья теневыносливых растений.",
    steps: [
      "Отодвиньте от окна или притеняйте тюлем в полдень.",
      "Обожжённые участки не восстановятся — их можно подрезать, когда появятся новые листья.",
    ],
    urgency: 1,
    symptoms: ["pale_patches", "brown_tips", "curling"],
  },
  {
    id: "natural_aging",
    title: "Естественное старение",
    about: "Если желтеет один-два самых старых нижних листа, а новые растут здоровыми — это нормально.",
    steps: ["Дождитесь, пока лист полностью пожелтеет, и аккуратно удалите его.", "Проверьте, что новые листья появляются."],
    urgency: 1,
    symptoms: ["yellow_lower"],
  },
  {
    id: "hunger",
    title: "Не хватает питания",
    about: "Земля за пару лет истощается: растение бледнеет и перестаёт расти.",
    steps: [
      "С весны до осени подкармливайте раз в 2–4 недели удобрением для комнатных растений.",
      "Если растение не пересаживали больше двух лет — пересадите в свежую землю.",
    ],
    urgency: 1,
    symptoms: ["no_growth", "yellow_lower", "leggy"],
  },
  {
    id: "stress",
    title: "Стресс от перемен",
    about: "Переезд, сквозняк, холодное окно или перестановка — растение сбрасывает листья, но потом привыкает.",
    steps: [
      "Не переставляйте растение ещё пару недель.",
      "Уберите от сквозняков и холодного стекла.",
      "Не подкармливайте, пока не появятся новые листья.",
    ],
    urgency: 1,
    symptoms: ["leaf_drop", "drooping", "curling"],
  },
  {
    id: "spider_mite",
    title: "Паутинный клещ",
    about: "Крошечные клещи на нижней стороне листа; любят сухой тёплый воздух. Быстро размножаются.",
    steps: [
      "Изолируйте растение от остальных.",
      "Промойте листья тёплым душем, особенно снизу.",
      "Обработайте акарицидом (например, Фитоверм) 3 раза с интервалом 5–7 дней.",
      "Повысьте влажность воздуха.",
    ],
    urgency: 3,
    symptoms: ["webs", "pale_patches", "curling", "leaf_drop"],
  },
  {
    id: "mealybug",
    title: "Мучнистый червец",
    about: "Белые пушистые комочки в пазухах листьев и на корнях, растение становится липким.",
    steps: [
      "Изолируйте растение.",
      "Снимите комочки ватной палочкой со спиртом.",
      "Обработайте системным инсектицидом (например, Актара) 2–3 раза с интервалом 7–10 дней.",
    ],
    urgency: 3,
    symptoms: ["white_cotton", "sticky", "yellow_many"],
  },
  {
    id: "scale",
    title: "Щитовка",
    about: "Неподвижные коричневые бугорки на стеблях и жилках, вокруг — липкий налёт.",
    steps: [
      "Изолируйте растение.",
      "Счистите щитки мягкой щёткой с мыльной водой.",
      "Обработайте системным инсектицидом 2–3 раза с интервалом 7–10 дней.",
    ],
    urgency: 3,
    symptoms: ["brown_bumps", "sticky", "yellow_many"],
  },
  {
    id: "thrips",
    title: "Трипсы",
    about: "Серебристые штрихи и чёрные точки на листьях — следы узких подвижных насекомых.",
    steps: [
      "Изолируйте растение и промойте под душем.",
      "Обработайте инсектицидом 3 раза с интервалом 5–7 дней; повесьте синие клеевые ловушки.",
    ],
    urgency: 3,
    symptoms: ["silver_streaks", "curling", "pale_patches"],
  },
  {
    id: "aphids",
    title: "Тля",
    about: "Колонии мелких зелёных или чёрных насекомых на молодых побегах, липкие листья.",
    steps: ["Смойте тлю под душем.", "Протрите листья раствором хозяйственного мыла или обработайте инсектицидом."],
    urgency: 2,
    symptoms: ["sticky", "curling"],
  },
  {
    id: "fungus_gnats",
    title: "Грибные комарики (сциариды)",
    about: "Мошки над землёй — их личинки живут в постоянно мокрой земле и могут повредить молодые корни.",
    steps: [
      "Дайте земле хорошо просохнуть между поливами.",
      "Повесьте жёлтые клеевые ловушки.",
      "Пролейте землю биопрепаратом против личинок или смените верхний слой.",
    ],
    urgency: 1,
    symptoms: ["gnats", "soil_wet"],
  },
  {
    id: "powdery_mildew",
    title: "Мучнистая роса",
    about: "Грибок: белый налёт, который стирается пальцем. Появляется при застое воздуха.",
    steps: [
      "Удалите сильно поражённые листья.",
      "Обработайте фунгицидом (например, Топаз) 2 раза с интервалом 7–10 дней.",
      "Проветривайте, не ставьте растения вплотную.",
    ],
    urgency: 2,
    symptoms: ["white_powder"],
  },
  {
    id: "leaf_spot",
    title: "Пятнистость листьев",
    about: "Грибковая или бактериальная инфекция: бурые пятна с жёлтым ободком, растут и сливаются.",
    steps: [
      "Удалите поражённые листья, не мочите листья при поливе.",
      "Обработайте медьсодержащим фунгицидом.",
      "Проветривайте и не переливайте.",
    ],
    urgency: 2,
    symptoms: ["spots_halo", "yellow_many", "leaf_drop"],
  },
  {
    id: "grey_mould",
    title: "Серая гниль",
    about: "Грибок ботритис: серый пушистый налёт на мягких тканях при сырости и прохладе.",
    steps: ["Срежьте поражённые части со здоровой тканью.", "Обработайте фунгицидом, уменьшите полив и проветривайте."],
    urgency: 3,
    symptoms: ["grey_fluff", "stem_black", "soil_wet"],
  },
];

/** Причина из справочника по id (им же отвечает Gemini). */
export const causeById = (id: string) => CAUSES.find((c) => c.id === id) ?? null;

export interface CauseMatch {
  cause: Cause;
  /** Сколько из отмеченных симптомов объясняет причина. */
  matched: string[];
  /** 0…1: доля отмеченных симптомов, которые объясняет причина. */
  score: number;
}

/**
 * Вероятные причины по отмеченным симптомам: сначала те, что объясняют больше симптомов,
 * при равенстве — у которых отмечен главный признак, затем более срочные и более «узкие».
 */
export function diagnose(symptomIds: string[], limit = 4): CauseMatch[] {
  const picked = new Set(symptomIds);
  if (!picked.size) return [];
  return CAUSES.map((cause) => {
    const matched = cause.symptoms.filter((s) => picked.has(s));
    return { cause, matched, score: matched.length / picked.size };
  })
    .filter((m) => m.matched.length > 0)
    .sort(
      (a, b) =>
        b.matched.length - a.matched.length ||
        Number(picked.has(b.cause.symptoms[0])) - Number(picked.has(a.cause.symptoms[0])) ||
        b.cause.urgency - a.cause.urgency ||
        a.cause.symptoms.length - b.cause.symptoms.length,
    )
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Распознавание по фото (Pl@ntNet): коды EPPO
// ---------------------------------------------------------------------------

/** Болезнь по фото: код EPPO, уверенность 0…1 и название от сервиса. */
export interface DiseaseGuess {
  eppo: string;
  score: number;
  name: string;
}

/** Проблема, которую увидел на фото Gemini; cause — id из CAUSES или «other». */
export interface AiProblem {
  cause: string;
  title: string;
  confidence: number;
  evidence: string;
}

/** Осмотр по фото от Gemini (функция identify-plant, режим diseases). */
export interface AiDiagnosis {
  isPlant: boolean;
  healthy: boolean;
  plant: string | null;
  summary: string;
  problems: AiProblem[];
}

/** Ответ проверки по фото: догадки Pl@ntNet и, если Gemini ответил, его разбор. */
export interface PhotoDiagnosis {
  guesses: DiseaseGuess[];
  ai: AiDiagnosis | null;
}

/** Частые коды EPPO → русское название и совет из справочника (по родам — первые 4 буквы + SP). */
const EPPO_RU: Record<string, { name: string; cause?: string }> = {
  ERYSSP: { name: "Мучнистая роса", cause: "powdery_mildew" },
  PODOSP: { name: "Мучнистая роса", cause: "powdery_mildew" },
  OIDISP: { name: "Мучнистая роса", cause: "powdery_mildew" },
  BOTRCI: { name: "Серая гниль", cause: "grey_mould" },
  BOTRSP: { name: "Серая гниль", cause: "grey_mould" },
  PYTHSP: { name: "Корневая гниль (питиум)", cause: "root_rot" },
  PHYTSP: { name: "Фитофтороз", cause: "root_rot" },
  FUSASP: { name: "Фузариоз", cause: "root_rot" },
  RHIZSO: { name: "Ризоктониоз", cause: "root_rot" },
  ALTESP: { name: "Альтернариоз (пятнистость)", cause: "leaf_spot" },
  SEPTSP: { name: "Септориоз (пятнистость)", cause: "leaf_spot" },
  CERCSP: { name: "Церкоспороз (пятнистость)", cause: "leaf_spot" },
  COLLSP: { name: "Антракноз", cause: "leaf_spot" },
  XANTSP: { name: "Бактериальная пятнистость", cause: "leaf_spot" },
  PSDMSP: { name: "Бактериальная пятнистость", cause: "leaf_spot" },
  PUCCSP: { name: "Ржавчина", cause: "leaf_spot" },
  TETRUR: { name: "Паутинный клещ", cause: "spider_mite" },
  PSECSP: { name: "Мучнистый червец", cause: "mealybug" },
  PLANCI: { name: "Мучнистый червец", cause: "mealybug" },
  COCCSP: { name: "Щитовка", cause: "scale" },
  FRANOC: { name: "Трипсы", cause: "thrips" },
  THRISP: { name: "Трипсы", cause: "thrips" },
  APHISP: { name: "Тля", cause: "aphids" },
  MYZUPE: { name: "Тля", cause: "aphids" },
};

/** Русское название и связанная причина из справочника — если код знаком. */
export function describeEppo(g: DiseaseGuess): { name: string; cause: Cause | null } {
  const known = EPPO_RU[g.eppo] ?? EPPO_RU[`${g.eppo.slice(0, 4)}SP`];
  return { name: known?.name ?? g.name, cause: known?.cause ? causeById(known.cause) : null };
}

/**
 * Ниже этой уверенности догадки сервиса — шум: на здоровой монстере Pl@ntNet выдаёт
 * случайные болезни с 3–8 %. Такие результаты не показываем.
 */
const MIN_DISEASE_SCORE = 0.15;
export const confidentGuesses = (list: DiseaseGuess[]) => list.filter((g) => g.score >= MIN_DISEASE_SCORE);

/** Страница болезни или вредителя в базе EPPO. */
export const eppoHref = (code: string) => `https://gd.eppo.int/taxon/${encodeURIComponent(code)}`;
