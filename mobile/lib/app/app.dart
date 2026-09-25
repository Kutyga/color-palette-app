import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../features/gamification/presentation/achievements_screen.dart';
import 'providers.dart';
import 'router.dart';
import 'theme.dart';

class GardenApp extends ConsumerStatefulWidget {
  const GardenApp({super.key});

  @override
  ConsumerState<GardenApp> createState() => _GardenAppState();
}

class _GardenAppState extends ConsumerState<GardenApp> {
  late final GoRouter _router = buildRouter(requireAuth: !ref.read(demoModeProvider));
  StreamSubscription<AuthState>? _authSub;
  final _messengerKey = GlobalKey<ScaffoldMessengerState>();

  @override
  void initState() {
    super.initState();
    if (!ref.read(demoModeProvider)) {
      // Смена пользователя — сбрасываем закэшированные данные прошлой сессии.
      _authSub = Supabase.instance.client.auth.onAuthStateChange.listen((_) {
        ref.invalidate(dueTasksProvider);
        ref.invalidate(myPlantsProvider);
        ref.invalidate(myLocationsProvider);
        ref.invalidate(plantDetailsProvider);
        ref.invalidate(gardenStatsProvider);
      });
    }
  }

  @override
  void dispose() {
    _authSub?.cancel();
    _router.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Очередь офлайн-изменений ушла на сервер — подтягиваем свежие данные.
    ref.listen(syncStateProvider, (prev, next) {
      final before = prev?.value?.pending ?? 0;
      final after = next.value?.pending ?? 0;
      if (before > 0 && after == 0) {
        ref.invalidate(dueTasksProvider);
        ref.invalidate(myPlantsProvider);
        ref.invalidate(plantDetailsProvider);
        ref.invalidate(gardenStatsProvider);
      }
    });
    return MaterialApp.router(
      title: 'Подоконник',
      debugShowCheckedModeBanner: false,
      theme: GardenTheme.light(),
      darkTheme: GardenTheme.dark(),
      locale: const Locale('ru'),
      supportedLocales: const [Locale('ru'), Locale('en')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      routerConfig: _router,
      scaffoldMessengerKey: _messengerKey,
      builder: (context, child) => AchievementCelebrations(messengerKey: _messengerKey, child: child!),
    );
  }
}
