import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/notifications/reminder_service.dart';
import '../data/garden_repository.dart';
import '../data/offline_garden_repository.dart';
import '../data/social_repository.dart';
import '../features/care/domain/care_models.dart';
import '../features/care/domain/care_type.dart';
import '../features/collection/domain/plant.dart';
import '../features/gamification/domain/gamification.dart';
import '../features/identify/data/plant_identifier.dart';
import '../features/knowledge_base/domain/species.dart';
import '../features/social/domain/social.dart';

/// Переопределяется в main() (Supabase или демо) и в тестах.
final gardenRepositoryProvider = Provider<GardenRepository>((ref) => throw UnimplementedError());

final socialRepositoryProvider = Provider<SocialRepository>((ref) => throw UnimplementedError());

final reminderServiceProvider = Provider<ReminderService>((ref) => const NoopReminderService());

/// Распознавание по фото; null — недоступно (демо-режим без сервера).
final plantIdentifierProvider = Provider<PlantIdentifier?>((ref) => null);

/// Связь и очередь офлайн-изменений; в демо-режиме всегда «всё отправлено».
final syncStateProvider = StreamProvider<SyncState>((ref) async* {
  final repo = ref.watch(gardenRepositoryProvider);
  if (repo is! OfflineGardenRepository) {
    yield const SyncState();
    return;
  }
  yield repo.state;
  yield* repo.states;
});

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

final gardenStatsProvider = FutureProvider<GardenStats>((ref) async {
  final (stats, activity) = await (
    ref.watch(gardenRepositoryProvider).stats(),
    ref.watch(socialRepositoryProvider).myActivity(),
  ).wait;
  return stats.withActivity(posts: activity.posts, likesReceived: activity.likesReceived);
});

final feedProvider = FutureProvider.family<List<FeedPost>, FeedTab>(
  (ref, tab) => ref.watch(socialRepositoryProvider).feed(tab),
);

final commentsProvider = FutureProvider.autoDispose.family<List<PostComment>, String>(
  (ref, postId) => ref.watch(socialRepositoryProvider).comments(postId),
);

/// Параметр — «только про мои растения».
final newsProvider = FutureProvider.family<List<NewsArticle>, bool>(
  (ref, onlyMine) => ref.watch(socialRepositoryProvider).news(onlyMySpecies: onlyMine),
);

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
