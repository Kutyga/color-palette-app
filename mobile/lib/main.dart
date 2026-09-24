import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app/app.dart';
import 'app/providers.dart';
import 'core/config.dart';
import 'core/notifications/reminder_service.dart';
import 'data/demo_garden_repository.dart';
import 'data/garden_repository.dart';
import 'data/supabase_garden_repository.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('ru');

  final GardenRepository repository;
  if (AppConfig.hasBackend) {
    await Supabase.initialize(url: AppConfig.supabaseUrl, publishableKey: AppConfig.supabaseKey);
    repository = SupabaseGardenRepository(Supabase.instance.client);
  } else {
    repository = await DemoGardenRepository().withSampleData();
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
      reminderServiceProvider.overrideWithValue(reminders),
      demoModeProvider.overrideWithValue(!AppConfig.hasBackend),
    ],
    child: const GardenApp(),
  ));
}
