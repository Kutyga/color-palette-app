import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:my_garden/core/notifications/reminder_service.dart';
import 'package:my_garden/data/demo_garden_repository.dart';
import 'package:my_garden/features/care/domain/care_models.dart';
import 'package:my_garden/features/care/domain/care_type.dart';
import 'package:my_garden/features/collection/domain/plant.dart';

void main() {
  group('DemoGardenRepository повторяет серверные триггеры', () {
    late DateTime now;
    late DemoGardenRepository repo;

    setUp(() {
      now = DateTime(2026, 7, 1);
      repo = DemoGardenRepository(clock: () => now);
    });

    Future<Plant> addMonstera() async {
      final room = await repo.addLocation('Гостиная', LightLevel.brightIndirect);
      return repo.addPlant(NewPlant(
        nickname: 'Мося',
        locationId: room.id,
        potMaterial: PotMaterial.plastic,
        waterIntervalDays: 7,
        lastWateredAt: DateTime(2026, 7, 1),
      ));
    }

    test('новый график считается от последнего полива', () async {
      final plant = await addMonstera();
      final water = (await repo.plantDetails(plant.id)).scheduleFor(CareType.water)!;
      expect(water.nextDueAt, DateTime(2026, 7, 7, 12));
    });

    test('полив сдвигает график и подстраивает коэффициент', () async {
      final plant = await addMonstera();
      now = DateTime(2026, 7, 7);
      await repo.logCare(plant.id, CareType.water);

      final details = await repo.plantDetails(plant.id);
      final water = details.scheduleFor(CareType.water)!;
      expect(water.userFactor, 0.98);
      expect(water.nextDueAt, DateTime(2026, 7, 13, 9, 36));
      expect(details.events, hasLength(1));
    });

    test('полив задним числом не откатывает график', () async {
      final plant = await addMonstera();
      await repo.logCare(plant.id, CareType.water, performedAt: DateTime(2026, 7, 7));
      await repo.logCare(plant.id, CareType.water, performedAt: DateTime(2026, 7, 3));
      final water = (await repo.plantDetails(plant.id)).scheduleFor(CareType.water)!;
      expect(water.lastDoneAt, DateTime(2026, 7, 7));
    });

    test('dueTasks возвращает задачи до горизонта по сроку', () async {
      final plant = await addMonstera();
      expect(await repo.dueTasks(DateTime(2026, 7, 5)), isEmpty);
      final tasks = await repo.dueTasks(DateTime(2026, 7, 8));
      expect(tasks.single.plantId, plant.id);
      expect(tasks.single.type, CareType.water);
    });

    test('график из базы знаний: полив, подкормка и пересадка', () async {
      final plant = await repo.addPlant(const NewPlant(nickname: 'Мося', speciesId: 'demo-monstera'));
      final details = await repo.plantDetails(plant.id);
      expect(details.schedules.map((s) => s.type), [CareType.water, CareType.fertilize, CareType.repot]);
      expect(details.scheduleFor(CareType.water)!.intervalDays, 8.2);
      expect(details.plant.speciesName, 'Монстера деликатесная');
    });

    test('поиск по народному названию и синониму', () async {
      expect((await repo.searchSpecies('тёщин')).single.slug, 'dracaena-trifasciata');
      expect((await repo.searchSpecies('sansevieria')).single.slug, 'dracaena-trifasciata');
    });
  });

  group('buildDailyReminders', () {
    CareTask task(String plant, CareType type, DateTime due) =>
        CareTask(scheduleId: '$plant-$type', plantId: plant, plantName: plant, type: type, dueAt: due);

    test('группирует по дням, просроченное — в первое напоминание', () {
      final now = DateTime(2026, 9, 24, 8);
      final reminders = buildDailyReminders([
        task('Мося', CareType.water, DateTime(2026, 9, 20)),
        task('Щучка', CareType.water, DateTime(2026, 9, 24, 15)),
        task('Фикус', CareType.fertilize, DateTime(2026, 9, 26, 10)),
      ], now);

      expect(reminders, hasLength(2));
      expect(reminders[0].at, DateTime(2026, 9, 24, 9));
      expect(reminders[0].title, 'Полить: 2 растения');
      expect(reminders[0].body, 'Полив: Мося, Щучка');
      expect(reminders[1].at, DateTime(2026, 9, 26, 9));
      expect(reminders[1].title, 'Подкормить: 1 растение');
    });

    test('если время сегодня прошло — напоминание через минуту', () {
      final now = DateTime(2026, 9, 24, 20);
      final reminders = buildDailyReminders(
        [task('Мося', CareType.water, DateTime(2026, 9, 24, 10)), task('Мося', CareType.mist, DateTime(2026, 9, 24, 10))],
        now,
        time: const TimeOfDay(hour: 9, minute: 0),
      );
      expect(reminders.single.at, DateTime(2026, 9, 24, 20, 1));
      expect(reminders.single.title, 'Уход за растениями: 1 растение');
    });
  });
}
