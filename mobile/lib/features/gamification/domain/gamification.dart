import 'package:flutter/material.dart';

/// Статистика садовника. На сервере считается RPC `my_garden_stats`
/// (supabase/migrations/20260924000005_gamification.sql), в демо-режиме — локально.
class GardenStats {
  const GardenStats({
    this.plants = 0,
    this.species = 0,
    this.locations = 0,
    this.petSafe = 0,
    this.succulents = 0,
    this.careEvents = 0,
    this.waterings = 0,
    this.fertilizings = 0,
    this.mistings = 0,
    this.repots = 0,
    this.earlyBird = 0,
    this.nightOwl = 0,
    this.currentStreak = 0,
    this.bestStreak = 0,
    this.posts = 0,
    this.likesReceived = 0,
  });

  final int plants;
  final int species;
  final int locations;
  final int petSafe;
  final int succulents;
  final int careEvents;
  final int waterings;
  final int fertilizings;
  final int mistings;
  final int repots;
  final int earlyBird;
  final int nightOwl;
  final int currentStreak;
  final int bestStreak;

  /// Социальная активность — приходит из SocialRepository.myActivity().
  final int posts;
  final int likesReceived;

  GardenStats withActivity({required int posts, required int likesReceived}) => GardenStats(
        plants: plants,
        species: species,
        locations: locations,
        petSafe: petSafe,
        succulents: succulents,
        careEvents: careEvents,
        waterings: waterings,
        fertilizings: fertilizings,
        mistings: mistings,
        repots: repots,
        earlyBird: earlyBird,
        nightOwl: nightOwl,
        currentStreak: currentStreak,
        bestStreak: bestStreak,
        posts: posts,
        likesReceived: likesReceived,
      );

  factory GardenStats.fromJson(Map<String, dynamic> j) {
    int v(String k) => (j[k] as num?)?.toInt() ?? 0;
    return GardenStats(
      plants: v('plants'),
      species: v('species'),
      locations: v('locations'),
      petSafe: v('pet_safe'),
      succulents: v('succulents'),
      careEvents: v('care_events'),
      waterings: v('waterings'),
      fertilizings: v('fertilizings'),
      mistings: v('mistings'),
      repots: v('repots'),
      earlyBird: v('early_bird'),
      nightOwl: v('night_owl'),
      currentStreak: v('current_streak'),
      bestStreak: v('best_streak'),
    );
  }
}

/// Сложность получения. Названия — стадии роста растения.
enum AchievementTier {
  sprout('Росток', 25, [Color(0xFF8BC34A), Color(0xFF558B2F)]),
  shoot('Побег', 50, [Color(0xFF26A69A), Color(0xFF00695C)]),
  tree('Дерево', 100, [Color(0xFFFFCA28), Color(0xFFEF6C00)]),
  baobab('Баобаб', 250, [Color(0xFFAB47BC), Color(0xFF3949AB)]);

  const AchievementTier(this.label, this.xp, this.gradient);

  final String label;
  final int xp;
  final List<Color> gradient;
}

class Achievement {
  const Achievement({
    required this.id,
    required this.title,
    required this.description,
    required this.tier,
    required this.icon,
    required this.target,
    required this.metric,
    this.secret = false,
  });

  final String id;
  final String title;
  final String description;
  final AchievementTier tier;
  final IconData icon;
  final int target;
  final int Function(GardenStats) metric;

  /// Секретные достижения не раскрывают условие, пока не получены.
  final bool secret;
}

class AchievementProgress {
  const AchievementProgress(this.achievement, this.current);

  final Achievement achievement;
  final int current;

  bool get unlocked => current >= achievement.target;
  double get fraction => (current / achievement.target).clamp(0, 1);
}

final achievements = <Achievement>[
  // Росток — первые шаги
  Achievement(id: 'first_sprout', title: 'Первый росток', description: 'Добавьте первое растение', tier: AchievementTier.sprout, icon: Icons.spa_rounded, target: 1, metric: (s) => s.plants),
  Achievement(id: 'wet_business', title: 'Мокрое дело', description: 'Отметьте первый полив', tier: AchievementTier.sprout, icon: Icons.water_drop_rounded, target: 1, metric: (s) => s.waterings),
  Achievement(id: 'big_move', title: 'Переезд века', description: 'Пересадите растение', tier: AchievementTier.sprout, icon: Icons.local_shipping_rounded, target: 1, metric: (s) => s.repots),
  Achievement(id: 'windowsill_star', title: 'Звезда подоконника', description: 'Опубликуйте первый пост', tier: AchievementTier.sprout, icon: Icons.photo_camera_rounded, target: 1, metric: (s) => s.posts),
  Achievement(id: 'interior_designer', title: 'Дизайнер подоконников', description: 'Заведите 3 места для растений', tier: AchievementTier.sprout, icon: Icons.chair_rounded, target: 3, metric: (s) => s.locations),

  // Побег — нужна регулярность
  Achievement(id: 'green_five', title: 'Зелёная пятилетка', description: 'Соберите 5 растений', tier: AchievementTier.shoot, icon: Icons.grass_rounded, target: 5, metric: (s) => s.plants),
  Achievement(id: 'no_drought_week', title: 'Неделя без засухи', description: 'Ухаживайте 7 дней подряд', tier: AchievementTier.shoot, icon: Icons.local_fire_department_rounded, target: 7, metric: (s) => s.bestStreak),
  Achievement(id: 'watering_can_traveler', title: 'Лейка-путешественница', description: '50 поливов', tier: AchievementTier.shoot, icon: Icons.opacity_rounded, target: 50, metric: (s) => s.waterings),
  Achievement(id: 'fertilizer_chef', title: 'Шеф-повар удобрений', description: '10 подкормок', tier: AchievementTier.shoot, icon: Icons.restaurant_rounded, target: 10, metric: (s) => s.fertilizings),
  Achievement(id: 'foggy_albion', title: 'Туманный Альбион', description: '20 опрыскиваний', tier: AchievementTier.shoot, icon: Icons.cloud_rounded, target: 20, metric: (s) => s.mistings),
  Achievement(id: 'cat_diplomat', title: 'Кошачий дипломат', description: '3 растения, безопасных для питомцев', tier: AchievementTier.shoot, icon: Icons.pets_rounded, target: 3, metric: (s) => s.petSafe),
  Achievement(id: 'camel_patience', title: 'Верблюжья выдержка', description: 'Соберите 3 суккулента', tier: AchievementTier.shoot, icon: Icons.landscape_rounded, target: 3, metric: (s) => s.succulents),
  Achievement(id: 'early_bird', title: 'Ранняя пташка', description: '5 раз поухаживать с 5 до 8 утра', tier: AchievementTier.shoot, icon: Icons.wb_twilight_rounded, target: 5, metric: (s) => s.earlyBird),
  Achievement(id: 'night_gardener', title: 'Ночной садовник', description: '5 раз поухаживать после 23:00', tier: AchievementTier.shoot, icon: Icons.nightlight_round, target: 5, metric: (s) => s.nightOwl, secret: true),

  Achievement(id: 'green_blogger', title: 'Зелёный блогер', description: '10 постов в ленте', tier: AchievementTier.shoot, icon: Icons.auto_stories_rounded, target: 10, metric: (s) => s.posts),

  // Дерево — серьёзная коллекция и дисциплина
  Achievement(id: 'ficus_influencer', title: 'Инфлюенсер фикусов', description: 'Соберите 100 лайков', tier: AchievementTier.tree, icon: Icons.favorite_rounded, target: 100, metric: (s) => s.likesReceived),
  Achievement(id: 'windowsill_garden', title: 'Ботсад на подоконнике', description: 'Соберите 15 растений', tier: AchievementTier.tree, icon: Icons.park_rounded, target: 15, metric: (s) => s.plants),
  Achievement(id: 'green_discipline', title: 'Месяц зелёной дисциплины', description: 'Ухаживайте 30 дней подряд', tier: AchievementTier.tree, icon: Icons.whatshot_rounded, target: 30, metric: (s) => s.bestStreak),
  Achievement(id: 'moisture_lord', title: 'Повелитель влаги', description: '250 поливов', tier: AchievementTier.tree, icon: Icons.waves_rounded, target: 250, metric: (s) => s.waterings),
  Achievement(id: 'latin_collector', title: 'Коллекционер латыни', description: '10 разных видов', tier: AchievementTier.tree, icon: Icons.menu_book_rounded, target: 10, metric: (s) => s.species),

  // Баобаб — легенды
  Achievement(id: 'jungle_calls', title: 'Джунгли зовут', description: 'Соберите 30 растений', tier: AchievementTier.baobab, icon: Icons.forest_rounded, target: 30, metric: (s) => s.plants),
  Achievement(id: 'hundred_days', title: 'Сто дней фотосинтеза', description: 'Ухаживайте 100 дней подряд', tier: AchievementTier.baobab, icon: Icons.wb_sunny_rounded, target: 100, metric: (s) => s.bestStreak),
  Achievement(id: 'botanical_celebrity', title: 'Ботаническая знаменитость', description: '1000 лайков на ваших постах', tier: AchievementTier.baobab, icon: Icons.star_rounded, target: 1000, metric: (s) => s.likesReceived, secret: true),
  Achievement(id: 'indoor_poseidon', title: 'Комнатный Посейдон', description: '1000 поливов', tier: AchievementTier.baobab, icon: Icons.tsunami_rounded, target: 1000, metric: (s) => s.waterings),
];

List<AchievementProgress> evaluateAchievements(GardenStats stats) =>
    [for (final a in achievements) AchievementProgress(a, a.metric(stats))];

/// Уровни садовника — от «Семечка» до «Хранителя джунглей».
class GardenerLevel {
  const GardenerLevel(this.number, this.title, this.minXp);

  final int number;
  final String title;
  final int minXp;
}

const gardenerLevels = [
  GardenerLevel(1, 'Семечко', 0),
  GardenerLevel(2, 'Росточек', 100),
  GardenerLevel(3, 'Юный садовник', 300),
  GardenerLevel(4, 'Зелёные руки', 700),
  GardenerLevel(5, 'Укротитель фикусов', 1500),
  GardenerLevel(6, 'Магистр фотосинтеза', 3000),
  GardenerLevel(7, 'Хранитель джунглей', 6000),
];

/// Опыт: полив 10, другой уход 15, растение в коллекции 25, плюс бонус за достижения.
int experience(GardenStats s) {
  final achievementsXp = evaluateAchievements(s).where((p) => p.unlocked).fold(0, (sum, p) => sum + p.achievement.tier.xp);
  return s.waterings * 10 + (s.careEvents - s.waterings) * 15 + s.plants * 25 + achievementsXp;
}

class LevelProgress {
  const LevelProgress({required this.level, required this.next, required this.xp});

  final GardenerLevel level;
  final GardenerLevel? next;
  final int xp;

  double get fraction => next == null ? 1 : (xp - level.minXp) / (next!.minXp - level.minXp);
  int get xpToNext => next == null ? 0 : next!.minXp - xp;
}

LevelProgress levelFor(GardenStats stats) {
  final xp = experience(stats);
  final index = gardenerLevels.lastIndexWhere((l) => xp >= l.minXp);
  return LevelProgress(
    level: gardenerLevels[index],
    next: index + 1 < gardenerLevels.length ? gardenerLevels[index + 1] : null,
    xp: xp,
  );
}
