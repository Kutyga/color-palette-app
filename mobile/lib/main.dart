import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app/app.dart';
import 'app/providers.dart';
import 'core/config.dart';
import 'core/notifications/reminder_service.dart';
import 'data/demo_garden_repository.dart';
import 'data/demo_social_repository.dart';
import 'data/garden_repository.dart';
import 'data/social_repository.dart';
import 'data/supabase_garden_repository.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('ru');

  final GardenRepository repository;
  final SocialRepository social;
  if (AppConfig.hasBackend) {
    await Supabase.initialize(url: AppConfig.supabaseUrl, publishableKey: AppConfig.supabaseKey);
    repository = SupabaseGardenRepository(Supabase.instance.client);
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
    ],
    child: const GardenApp(),
  ));
}
