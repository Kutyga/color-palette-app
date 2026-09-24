import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:my_garden/app/app.dart';
import 'package:my_garden/app/providers.dart';
import 'package:my_garden/data/demo_garden_repository.dart';
import 'package:my_garden/data/demo_social_repository.dart';
import 'package:my_garden/features/care/domain/care_type.dart';
import 'package:my_garden/features/collection/domain/plant.dart';
import 'package:my_garden/features/gamification/domain/gamification.dart';

void main() {
  group('достижения и уровни', () {
    test('у новичка ничего не открыто, уровень «Семечко»', () {
      const stats = GardenStats();
      expect(evaluateAchievements(stats).where((p) => p.unlocked), isEmpty);
      expect(levelFor(stats).level.title, 'Семечко');
      expect(levelFor(stats).xpToNext, 100);
    });

    test('первое растение и полив открывают два «Ростка»', () {
      const stats = GardenStats(plants: 1, waterings: 1, careEvents: 1);
      final unlocked = evaluateAchievements(stats).where((p) => p.unlocked).map((p) => p.achievement.id);
      expect(unlocked, containsAll(['first_sprout', 'wet_business']));
      // 25 (растение) + 10 (полив) + 2 × 25 (достижения) = 85 XP
      expect(experience(stats), 85);
    });

    test('прогресс считается долей от цели и не превышает 1', () {
      final week = evaluateAchievements(const GardenStats(bestStreak: 3)).firstWhere((p) => p.achievement.id == 'no_drought_week');
      expect(week.fraction, closeTo(3 / 7, 1e-9));
      final done = evaluateAchievements(const GardenStats(bestStreak: 12)).firstWhere((p) => p.achievement.id == 'no_drought_week');
      expect(done.fraction, 1);
      expect(done.unlocked, isTrue);
    });

    test('у каждой сложности есть достижения, id уникальны', () {
      for (final tier in AchievementTier.values) {
        expect(achievements.where((a) => a.tier == tier), isNotEmpty, reason: tier.label);
      }
      expect(achievements.map((a) => a.id).toSet(), hasLength(achievements.length));
    });

    test('максимальный уровень', () {
      const stats = GardenStats(waterings: 1000, careEvents: 1000, plants: 30);
      final lp = levelFor(stats);
      expect(lp.level.title, 'Хранитель джунглей');
      expect(lp.next, isNull);
      expect(lp.fraction, 1);
    });
  });

  group('статистика демо-репозитория', () {
    test('серии: текущая и лучшая', () async {
      var now = DateTime(2026, 9, 1, 10);
      final repo = DemoGardenRepository(clock: () => now);
      final plant = await repo.addPlant(const NewPlant(nickname: 'Щучка', speciesId: 'demo-sansevieria'));
      for (final day in [1, 2, 3, 4, 10, 11]) {
        await repo.logCare(plant.id, CareType.water, performedAt: DateTime(2026, 9, day, 6, 30));
      }
      now = DateTime(2026, 9, 12, 9);
      final stats = await repo.stats();
      expect(stats.bestStreak, 4);
      expect(stats.currentStreak, 2);
      expect(stats.waterings, 6);
      expect(stats.earlyBird, 6);
      expect(stats.succulents, 1);

      now = DateTime(2026, 9, 14);
      expect((await repo.stats()).currentStreak, 0, reason: 'пропуск дня обрывает серию');
    });
  });

  testWidgets('полив в приложении празднуется достижением', (tester) async {
    await initializeDateFormatting('ru');
    final repo = DemoGardenRepository();
    await repo.addPlant(NewPlant(nickname: 'Мося', waterIntervalDays: 7, lastWateredAt: DateTime.now().subtract(const Duration(days: 10))));
    await tester.pumpWidget(ProviderScope(
      overrides: [
        gardenRepositoryProvider.overrideWithValue(repo),
        socialRepositoryProvider.overrideWithValue(DemoSocialRepository(garden: repo)),
        demoModeProvider.overrideWithValue(true),
      ],
      child: const GardenApp(),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Начните серию'), findsOneWidget);

    await tester.tap(find.byTooltip('Полить'));
    await tester.pumpAndSettle();

    expect(find.text('1 день подряд'), findsOneWidget);
    expect(find.text('Новое достижение!'), findsOneWidget);
    expect(find.textContaining('Мокрое дело'), findsOneWidget);
  });
}
