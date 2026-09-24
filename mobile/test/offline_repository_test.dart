import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:my_garden/app/app.dart';
import 'package:my_garden/app/providers.dart';
import 'package:my_garden/core/offline/local_store.dart';
import 'package:my_garden/data/demo_garden_repository.dart';
import 'package:my_garden/data/demo_social_repository.dart';
import 'package:my_garden/data/garden_repository.dart';
import 'package:my_garden/data/offline_garden_repository.dart';
import 'package:my_garden/features/care/domain/care_models.dart';
import 'package:my_garden/features/care/domain/care_type.dart';
import 'package:my_garden/features/collection/domain/plant.dart';
import 'package:my_garden/features/gamification/domain/gamification.dart';
import 'package:my_garden/features/knowledge_base/domain/species.dart';

/// «Сервер», у которого можно выдернуть сеть.
class FlakyRemote implements GardenRepository {
  FlakyRemote(this.inner);

  final DemoGardenRepository inner;
  bool offline = false;
  int logCareCalls = 0;

  Future<T> _call<T>(Future<T> Function() f) async {
    if (offline) throw const SocketException('Failed host lookup: example.supabase.co');
    return f();
  }

  @override
  Future<List<Plant>> myPlants() => _call(inner.myPlants);
  @override
  Future<PlantDetails> plantDetails(String plantId) => _call(() => inner.plantDetails(plantId));
  @override
  Future<Plant> addPlant(NewPlant draft) => _call(() => inner.addPlant(draft));
  @override
  Future<void> deletePlant(String plantId) => _call(() => inner.deletePlant(plantId));
  @override
  Future<void> setPlantPhoto(String plantId, Uint8List jpeg) => _call(() => inner.setPlantPhoto(plantId, jpeg));
  @override
  Future<List<Location>> myLocations() => _call(inner.myLocations);
  @override
  Future<Location> addLocation(String name, LightLevel? light) => _call(() => inner.addLocation(name, light));
  @override
  Future<List<CareTask>> dueTasks(DateTime until) => _call(() => inner.dueTasks(until));
  @override
  Future<void> logCare(String plantId, CareType type, {String? id, DateTime? performedAt, String? note}) => _call(() {
        logCareCalls++;
        return inner.logCare(plantId, type, id: id, performedAt: performedAt, note: note);
      });
  @override
  Future<List<Species>> searchSpecies(String query) => _call(() => inner.searchSpecies(query));
  @override
  Future<List<Species>> popularSpecies() => _call(inner.popularSpecies);
  @override
  Future<Species?> species(String id) => _call(() => inner.species(id));
  @override
  Future<GardenStats> stats() => _call(inner.stats);
}

void main() {
  late DateTime now;
  late FlakyRemote remote;
  late MemoryStore store;
  late OfflineGardenRepository repo;
  late Plant plant;

  setUp(() async {
    now = DateTime(2026, 7, 7, 10);
    remote = FlakyRemote(DemoGardenRepository(clock: () => now));
    final room = await remote.inner.addLocation('Гостиная', LightLevel.brightIndirect);
    plant = await remote.inner.addPlant(NewPlant(
      nickname: 'Мося',
      locationId: room.id,
      potMaterial: PotMaterial.plastic,
      waterIntervalDays: 7,
      lastWateredAt: DateTime(2026, 6, 25),
    ));
    store = MemoryStore();
    repo = OfflineGardenRepository(remote, store, clock: () => now);
  });

  tearDown(() => repo.dispose());

  Future<void> warmUpCache() async {
    await repo.myPlants();
    await repo.plantDetails(plant.id);
    await repo.dueTasks(now.add(const Duration(days: 7)));
    await repo.stats();
  }

  test('без сети отдаются сохранённые данные', () async {
    await warmUpCache();
    remote.offline = true;

    expect((await repo.myPlants()).single.nickname, 'Мося');
    expect((await repo.plantDetails(plant.id)).schedules, isNotEmpty);
    expect(await repo.dueTasks(now.add(const Duration(days: 7))), hasLength(1));
    expect(repo.state.offline, isTrue);
  });

  test('без сети и без копии — честная ошибка', () async {
    remote.offline = true;
    await expectLater(repo.myPlants(), throwsA(isA<SocketException>()));
  });

  test('полив без сети: очередь, локальный пересчёт, отправка без дублей', () async {
    await warmUpCache();
    remote.offline = true;

    await repo.logCare(plant.id, CareType.water);
    expect(repo.state.pending, 1);

    // Задача ушла из «Сегодня», график пересчитан на устройстве.
    final tasks = await repo.dueTasks(now.add(const Duration(days: 1)));
    expect(tasks, isEmpty);
    final local = await repo.plantDetails(plant.id);
    expect(local.events.single.type, CareType.water);
    final localDue = local.scheduleFor(CareType.water)!.nextDueAt;
    expect(localDue!.isAfter(now), isTrue);
    expect((await repo.myPlants()).single.nextWaterAt!.isAtSameMomentAs(localDue), isTrue);

    // Сеть вернулась: очередь уходит, сервер считает тот же срок.
    remote.offline = false;
    await repo.sync();
    expect(repo.state.pending, 0);
    expect(repo.state.offline, isFalse);
    final server = await remote.inner.plantDetails(plant.id);
    expect(server.events, hasLength(1));
    expect(server.scheduleFor(CareType.water)!.nextDueAt!.isAtSameMomentAs(localDue), isTrue);

    // Повторная отправка той же отметки (ответ потерялся) не создаёт дубль.
    final eventId = server.events.single.id;
    await repo.logCare(plant.id, CareType.water, id: eventId, performedAt: now);
    expect((await remote.inner.plantDetails(plant.id)).events, hasLength(1));
  });

  test('очередь переживает перезапуск приложения', () async {
    await warmUpCache();
    remote.offline = true;
    await repo.logCare(plant.id, CareType.mist);
    repo.dispose();

    final restarted = OfflineGardenRepository(remote, store, clock: () => now);
    expect(restarted.state.pending, 1);
    remote.offline = false;
    await restarted.sync();
    expect(restarted.state.pending, 0);
    expect((await remote.inner.plantDetails(plant.id)).events.single.type, CareType.mist);
    restarted.dispose();
  });

  test('чтение с сетью сначала досылает очередь', () async {
    await warmUpCache();
    remote.offline = true;
    await repo.logCare(plant.id, CareType.water);
    remote.offline = false;

    await repo.dueTasks(now.add(const Duration(days: 7)));
    expect(remote.logCareCalls, 1);
    expect(repo.state.pending, 0);
  });

  testWidgets('плашка «Нет сети» на экране «Сегодня»', (tester) async {
    await initializeDateFormatting('ru');
    now = DateTime.now();
    final inner = DemoGardenRepository();
    await inner.addPlant(NewPlant(nickname: 'Мося', waterIntervalDays: 7, lastWateredAt: DateTime.now().subtract(const Duration(days: 10))));
    final flaky = FlakyRemote(inner);
    final offlineRepo = OfflineGardenRepository(flaky, MemoryStore());
    addTearDown(offlineRepo.dispose);

    await tester.pumpWidget(ProviderScope(
      overrides: [
        gardenRepositoryProvider.overrideWithValue(offlineRepo),
        socialRepositoryProvider.overrideWithValue(DemoSocialRepository(garden: inner)),
        demoModeProvider.overrideWithValue(true),
      ],
      child: const GardenApp(),
    ));
    await tester.pumpAndSettle();

    flaky.offline = true;
    await tester.tap(find.byTooltip('Полить'));
    await tester.pumpAndSettle();

    expect(find.text('Нет сети · 1 отметка ждёт отправки'), findsOneWidget);
    expect(find.text('Ждут заботы'), findsNothing, reason: 'полив засчитан сразу');

    flaky.offline = false;
    await tester.runAsync(offlineRepo.sync);
    await tester.pumpAndSettle();
    expect(find.textContaining('отправки'), findsNothing);
    expect(find.byIcon(Icons.cloud_off_rounded), findsNothing);
  });
}
