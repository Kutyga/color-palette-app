import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app/app.dart';
import 'app/providers.dart';
import 'core/config.dart';
import 'core/offline/local_store.dart';
import 'core/notifications/reminder_service.dart';
import 'data/demo_garden_repository.dart';
import 'data/demo_social_repository.dart';
import 'data/garden_repository.dart';
import 'data/offline_garden_repository.dart';
import 'data/social_repository.dart';
import 'data/supabase_garden_repository.dart';
import 'features/identify/data/plant_identifier.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('ru');

  final GardenRepository repository;
  final SocialRepository social;
  if (AppConfig.hasBackend) {
    await Supabase.initialize(url: AppConfig.supabaseUrl, publishableKey: AppConfig.supabaseKey);
    final offline = OfflineGardenRepository(SupabaseGardenRepository(Supabase.instance.client), await SharedPrefsStore.create())
      ..startAutoSync();
    repository = offline;
    social = SupabaseSocialRepository(Supabase.instance.client);
  } else {
    repository = await DemoGardenRepository().withSampleData();
    social = DemoSocialRepository(garden: repository);
  }

  final reminders = LocalReminderService();
  try {
    await reminders.init();
  } catch (e) {
    debugPrint('Напоминания недоступны: $e');
  }

  runApp(ProviderScope(
    overrides: [
      gardenRepositoryProvider.overrideWithValue(repository),
      socialRepositoryProvider.overrideWithValue(social),
      reminderServiceProvider.overrideWithValue(reminders),
      demoModeProvider.overrideWithValue(!AppConfig.hasBackend),
      if (AppConfig.hasBackend)
        plantIdentifierProvider.overrideWithValue(
          FallbackPlantIdentifier(
            PlantNetIdentifier(Supabase.instance.client),
            TflitePlantIdentifier(modelUrl: AppConfig.plantModelUrl, labelsUrl: AppConfig.plantLabelsUrl),
          ),
        ),
    ],
    child: const GardenApp(),
  ));
}
