import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/notifications/reminder_service.dart';
import '../data/garden_repository.dart';
import '../features/care/domain/care_models.dart';
import '../features/care/domain/care_type.dart';
import '../features/collection/domain/plant.dart';
import '../features/gamification/domain/gamification.dart';
import '../features/knowledge_base/domain/species.dart';

/// Переопределяется в main() (Supabase или демо) и в тестах.
final gardenRepositoryProvider = Provider<GardenRepository>((ref) => throw UnimplementedError());

final reminderServiceProvider = Provider<ReminderService>((ref) => const NoopReminderService());

/// true — работаем без сервера, данные только в памяти.
final demoModeProvider = Provider<bool>((ref) => false);

/// Горизонт экрана «Сегодня» и напоминаний.
const upcomingHorizon = Duration(days: 7);

final dueTasksProvider = FutureProvider<List<CareTask>>(
  (ref) => ref.watch(gardenRepositoryProvider).dueTasks(DateTime.now().add(upcomingHorizon)),
);

final myPlantsProvider = FutureProvider<List<Plant>>((ref) => ref.watch(gardenRepositoryProvider).myPlants());

final myLocationsProvider =
    FutureProvider<List<Location>>((ref) => ref.watch(gardenRepositoryProvider).myLocations());

final plantDetailsProvider = FutureProvider.family<PlantDetails, String>(
  (ref, id) => ref.watch(gardenRepositoryProvider).plantDetails(id),
);

final speciesSearchProvider = FutureProvider.family<List<Species>, String>(
  (ref, query) => ref.watch(gardenRepositoryProvider).searchSpecies(query),
);

final speciesProvider = FutureProvider.family<Species?, String>(
  (ref, id) => ref.watch(gardenRepositoryProvider).species(id),
);

final gardenStatsProvider = FutureProvider<GardenStats>((ref) => ref.watch(gardenRepositoryProvider).stats());

/// Действия, после которых нужно обновить связанные экраны.
extension GardenActions on WidgetRef {
  Future<void> logCare(String plantId, CareType type) async {
    await read(gardenRepositoryProvider).logCare(plantId, type);
    invalidate(dueTasksProvider);
    invalidate(myPlantsProvider);
    invalidate(plantDetailsProvider(plantId));
    invalidate(gardenStatsProvider);
  }

  void refreshCollection() {
    invalidate(dueTasksProvider);
    invalidate(myPlantsProvider);
    invalidate(myLocationsProvider);
    invalidate(gardenStatsProvider);
  }
}
