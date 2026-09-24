import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

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
    return MaterialApp.router(
      title: 'Мой сад',
      debugShowCheckedModeBanner: false,
      theme: GardenTheme.light(),
      darkTheme: GardenTheme.dark(),
      locale: const Locale('ru'),
      supportedLocales: const [Locale('ru'), Locale('en')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      routerConfig: _router,
    );
  }
}
