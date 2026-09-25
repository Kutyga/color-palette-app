/**
 * Статистика садовника. На сервере считается RPC `my_garden_stats`
 * (supabase/migrations/20260924133423_gamification.sql), в демо-режиме — локально.
 */
export interface GardenStats {
  plants: number;
  species: number;
  locations: number;
  petSafe: number;
  succulents: number;
  careEvents: number;
  waterings: number;
  fertilizings: number;
  mistings: number;
  repots: number;
  earlyBird: number;
  nightOwl: number;
  currentStreak: number;
  bestStreak: number;
  /** Социальная активность — из SocialRepository.myActivity(). */
  posts: number;
  likesReceived: number;
}

export const EMPTY_STATS: GardenStats = {
  plants: 0, species: 0, locations: 0, petSafe: 0, succulents: 0, careEvents: 0, waterings: 0,
  fertilizings: 0, mistings: 0, repots: 0, earlyBird: 0, nightOwl: 0, currentStreak: 0, bestStreak: 0,
  posts: 0, likesReceived: 0,
};

export function statsFromRow(j: Record<string, unknown>): GardenStats {
  const v = (k: string) => Number(j[k] ?? 0);
  return {
    ...EMPTY_STATS,
    plants: v("plants"),
    species: v("species"),
    locations: v("locations"),
    petSafe: v("pet_safe"),
    succulents: v("succulents"),
    careEvents: v("care_events"),
    waterings: v("waterings"),
    fertilizings: v("fertilizings"),
    mistings: v("mistings"),
    repots: v("repots"),
    earlyBird: v("early_bird"),
    nightOwl: v("night_owl"),
    currentStreak: v("current_streak"),
    bestStreak: v("best_streak"),
  };
}

/** Сложность получения. Названия — стадии роста растения. */
export const TIERS = {
  sprout: { label: "Росток", xp: 25, gradient: ["#8BC34A", "#558B2F"] },
  shoot: { label: "Побег", xp: 50, gradient: ["#26A69A", "#00695C"] },
  tree: { label: "Дерево", xp: 100, gradient: ["#FFCA28", "#EF6C00"] },
  baobab: { label: "Баобаб", xp: 250, gradient: ["#AB47BC", "#3949AB"] },
} as const;
export type Tier = keyof typeof TIERS;

export interface Achievement {
  id: string;
  title: string;
  description: string;
  tier: Tier;
  /** Имя иконки lucide. */
  icon: string;
  target: number;
  metric: (s: GardenStats) => number;
  /** Секретные достижения не раскрывают условие, пока не получены. */
  secret?: boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  // Росток — первые шаги
  { id: "first_sprout", title: "Первый росток", description: "Добавьте первое растение", tier: "sprout", icon: "Sprout", target: 1, metric: (s) => s.plants },
  { id: "wet_business", title: "Мокрое дело", description: "Отметьте первый полив", tier: "sprout", icon: "Droplet", target: 1, metric: (s) => s.waterings },
  { id: "big_move", title: "Переезд века", description: "Пересадите растение", tier: "sprout", icon: "Truck", target: 1, metric: (s) => s.repots },
  { id: "windowsill_star", title: "Звезда подоконника", description: "Опубликуйте первый пост", tier: "sprout", icon: "Camera", target: 1, metric: (s) => s.posts },
  { id: "interior_designer", title: "Дизайнер подоконников", description: "Заведите 3 места для растений", tier: "sprout", icon: "Armchair", target: 3, metric: (s) => s.locations },
  // Побег — нужна регулярность
  { id: "green_five", title: "Зелёная пятилетка", description: "Соберите 5 растений", tier: "shoot", icon: "Leaf", target: 5, metric: (s) => s.plants },
  { id: "no_drought_week", title: "Неделя без засухи", description: "Ухаживайте 7 дней подряд", tier: "shoot", icon: "Flame", target: 7, metric: (s) => s.bestStreak },
  { id: "watering_can_traveler", title: "Лейка-путешественница", description: "50 поливов", tier: "shoot", icon: "Droplets", target: 50, metric: (s) => s.waterings },
  { id: "fertilizer_chef", title: "Шеф-повар удобрений", description: "10 подкормок", tier: "shoot", icon: "ChefHat", target: 10, metric: (s) => s.fertilizings },
  { id: "foggy_albion", title: "Туманный Альбион", description: "20 опрыскиваний", tier: "shoot", icon: "Cloud", target: 20, metric: (s) => s.mistings },
  { id: "cat_diplomat", title: "Кошачий дипломат", description: "3 растения, безопасных для питомцев", tier: "shoot", icon: "Cat", target: 3, metric: (s) => s.petSafe },
  { id: "camel_patience", title: "Верблюжья выдержка", description: "Соберите 3 суккулента", tier: "shoot", icon: "Mountain", target: 3, metric: (s) => s.succulents },
  { id: "early_bird", title: "Ранняя пташка", description: "5 раз поухаживать с 5 до 8 утра", tier: "shoot", icon: "Sunrise", target: 5, metric: (s) => s.earlyBird },
  { id: "night_gardener", title: "Ночной садовник", description: "5 раз поухаживать после 23:00", tier: "shoot", icon: "Moon", target: 5, metric: (s) => s.nightOwl, secret: true },
  { id: "green_blogger", title: "Зелёный блогер", description: "10 постов в ленте", tier: "shoot", icon: "BookOpen", target: 10, metric: (s) => s.posts },
  // Дерево — серьёзная коллекция и дисциплина
  { id: "ficus_influencer", title: "Инфлюенсер фикусов", description: "Соберите 100 лайков", tier: "tree", icon: "Heart", target: 100, metric: (s) => s.likesReceived },
  { id: "windowsill_garden", title: "Ботсад на подоконнике", description: "Соберите 15 растений", tier: "tree", icon: "Trees", target: 15, metric: (s) => s.plants },
  { id: "green_discipline", title: "Месяц зелёной дисциплины", description: "Ухаживайте 30 дней подряд", tier: "tree", icon: "Zap", target: 30, metric: (s) => s.bestStreak },
  { id: "moisture_lord", title: "Повелитель влаги", description: "250 поливов", tier: "tree", icon: "Waves", target: 250, metric: (s) => s.waterings },
  { id: "latin_collector", title: "Коллекционер латыни", description: "10 разных видов", tier: "tree", icon: "Library", target: 10, metric: (s) => s.species },
  // Баобаб — легенды
  { id: "jungle_calls", title: "Джунгли зовут", description: "Соберите 30 растений", tier: "baobab", icon: "TreePalm", target: 30, metric: (s) => s.plants },
  { id: "hundred_days", title: "Сто дней фотосинтеза", description: "Ухаживайте 100 дней подряд", tier: "baobab", icon: "Sun", target: 100, metric: (s) => s.bestStreak },
  { id: "botanical_celebrity", title: "Ботаническая знаменитость", description: "1000 лайков на ваших постах", tier: "baobab", icon: "Star", target: 1000, metric: (s) => s.likesReceived, secret: true },
  { id: "indoor_poseidon", title: "Комнатный Посейдон", description: "1000 поливов", tier: "baobab", icon: "Anchor", target: 1000, metric: (s) => s.waterings },
];

export interface AchievementProgress {
  achievement: Achievement;
  current: number;
  unlocked: boolean;
  fraction: number;
}

export function evaluateAchievements(stats: GardenStats): AchievementProgress[] {
  return ACHIEVEMENTS.map((a) => {
    const current = a.metric(stats);
    return { achievement: a, current, unlocked: current >= a.target, fraction: Math.min(1, current / a.target) };
  });
}

/** Уровни садовника — от «Семечка» до «Хранителя джунглей». */
export const LEVELS = [
  { number: 1, title: "Семечко", minXp: 0 },
  { number: 2, title: "Росточек", minXp: 100 },
  { number: 3, title: "Юный садовник", minXp: 300 },
  { number: 4, title: "Зелёные руки", minXp: 700 },
  { number: 5, title: "Укротитель фикусов", minXp: 1500 },
  { number: 6, title: "Магистр фотосинтеза", minXp: 3000 },
  { number: 7, title: "Хранитель джунглей", minXp: 6000 },
] as const;
export type Level = (typeof LEVELS)[number];

/** Опыт: полив 10, другой уход 15, растение в коллекции 25, плюс бонус за достижения. */
export function experience(s: GardenStats): number {
  const bonus = evaluateAchievements(s)
    .filter((p) => p.unlocked)
    .reduce((sum, p) => sum + TIERS[p.achievement.tier].xp, 0);
  return s.waterings * 10 + (s.careEvents - s.waterings) * 15 + s.plants * 25 + bonus;
}

export interface LevelProgress {
  level: Level;
  next: Level | null;
  xp: number;
  fraction: number;
  xpToNext: number;
}

export function levelFor(stats: GardenStats): LevelProgress {
  const xp = experience(stats);
  let index = 0;
  LEVELS.forEach((l, i) => {
    if (xp >= l.minXp) index = i;
  });
  const level = LEVELS[index];
  const next = LEVELS[index + 1] ?? null;
  return {
    level,
    next,
    xp,
    fraction: next ? (xp - level.minXp) / (next.minXp - level.minXp) : 1,
    xpToNext: next ? next.minXp - xp : 0,
  };
}
