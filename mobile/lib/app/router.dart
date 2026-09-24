import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../features/auth/sign_in_screen.dart';
import '../features/collection/presentation/add_plant_screen.dart';
import '../features/collection/presentation/collection_screen.dart';
import '../features/collection/presentation/plant_screen.dart';
import '../features/gamification/presentation/achievements_screen.dart';
import '../features/knowledge_base/presentation/knowledge_screen.dart';
import '../features/knowledge_base/presentation/species_screen.dart';
import '../features/profile/profile_screen.dart';
import '../features/social/create_post_screen.dart';
import '../features/social/feed_screen.dart';
import '../features/today/today_screen.dart';
import 'theme.dart';

/// [requireAuth] — только при подключённом Supabase; в демо-режиме входа нет.
GoRouter buildRouter({required bool requireAuth}) {
  final auth = requireAuth ? _AuthListenable(Supabase.instance.client.auth) : null;
  return GoRouter(
    initialLocation: '/today',
    refreshListenable: auth,
    redirect: (context, state) {
      if (auth == null) return null;
      final signedIn = auth.signedIn;
      final atSignIn = state.matchedLocation == '/sign-in';
      if (!signedIn && !atSignIn) return '/sign-in';
      if (signedIn && atSignIn) return '/today';
      return null;
    },
    routes: [
      GoRoute(path: '/sign-in', builder: (_, _) => const SignInScreen()),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => _HomeShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/today', builder: (_, _) => const TodayScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/collection', builder: (_, _) => const CollectionScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/feed', builder: (_, _) => const FeedScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/knowledge', builder: (_, _) => const KnowledgeScreen())]),
        ],
      ),
      GoRoute(
        path: '/add',
        pageBuilder: (_, _) => const MaterialPage(fullscreenDialog: true, child: AddPlantScreen()),
      ),
      GoRoute(
        path: '/post/new',
        pageBuilder: (_, state) => MaterialPage(
          fullscreenDialog: true,
          child: CreatePostScreen(plantId: state.uri.queryParameters['plant']),
        ),
      ),
      GoRoute(path: '/plant/:id', builder: (_, state) => PlantScreen(plantId: state.pathParameters['id']!)),
      GoRoute(path: '/species/:id', builder: (_, state) => SpeciesScreen(speciesId: state.pathParameters['id']!)),
      GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen()),
      GoRoute(path: '/achievements', builder: (_, _) => const AchievementsScreen()),
    ],
  );
}

/// Центральная «+»: растение в коллекцию или пост в ленту.
void _showCreateSheet(BuildContext context) {
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (sheet) {
      final c = sheet.garden;
      Widget option(IconData icon, Color color, String title, String subtitle, String route) => ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: GardenTheme.gutter, vertical: 4),
            leading: CircleAvatar(radius: 24, backgroundColor: color.withValues(alpha: 0.14), child: Icon(icon, color: color)),
            title: Text(title, style: sheet.text.titleMedium),
            subtitle: Text(subtitle),
            onTap: () {
              Navigator.pop(sheet);
              context.push(route);
            },
          );
      return SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            option(Icons.local_florist_rounded, c.leaf, 'Растение', 'Добавить в коллекцию и настроить уход', '/add'),
            option(Icons.add_a_photo_rounded, c.water, 'Пост', 'Поделиться фото с сообществом', '/post/new'),
            const SizedBox(height: 12),
          ],
        ),
      );
    },
  );
}

class _AuthListenable extends ChangeNotifier {
  _AuthListenable(GoTrueClient auth) : signedIn = auth.currentSession != null {
    _sub = auth.onAuthStateChange.listen((s) {
      signedIn = s.session != null;
      notifyListeners();
    });
  }

  bool signedIn;
  late final StreamSubscription<AuthState> _sub;

  @override
  void dispose() {
    _sub.cancel();
    super.dispose();
  }
}

/// Нижняя навигация: полупрозрачная с размытием (iOS), центральная «+» (Instagram).
class _HomeShell extends StatelessWidget {
  const _HomeShell({required this.shell});

  final StatefulNavigationShell shell;

  static const _items = [
    (Icons.water_drop_outlined, Icons.water_drop_rounded, 'Сегодня'),
    (Icons.grid_view_outlined, Icons.grid_view_rounded, 'Коллекция'),
    (Icons.play_circle_outline_rounded, Icons.play_circle_rounded, 'Лента'),
    (Icons.menu_book_outlined, Icons.menu_book_rounded, 'Знания'),
  ];

  @override
  Widget build(BuildContext context) {
    final onFeed = shell.currentIndex == 2;
    final c = context.garden;
    final barColor = onFeed ? Colors.black.withValues(alpha: 0.6) : Theme.of(context).navigationBarTheme.backgroundColor;
    final fg = onFeed ? Colors.white : Theme.of(context).colorScheme.onSurface;

    Widget item(int index) {
      final (icon, selectedIcon, label) = _items[index];
      final selected = shell.currentIndex == index;
      return Expanded(
        child: Semantics(
          selected: selected,
          button: true,
          label: label,
          child: InkResponse(
            onTap: () {
              HapticFeedback.selectionClick();
              shell.goBranch(index, initialLocation: index == shell.currentIndex);
            },
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(selected ? selectedIcon : icon, color: selected ? (onFeed ? Colors.white : c.leaf) : fg.withValues(alpha: 0.6)),
                const SizedBox(height: 2),
                Text(
                  label,
                  style: TextStyle(fontSize: 11, fontWeight: selected ? FontWeight.w600 : FontWeight.w500, color: selected ? (onFeed ? Colors.white : c.leaf) : fg.withValues(alpha: 0.6)),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      extendBody: true,
      body: shell,
      bottomNavigationBar: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
          child: Container(
            color: barColor,
            child: SafeArea(
              top: false,
              child: SizedBox(
                height: 60,
                child: Row(
                  children: [
                    item(0),
                    item(1),
                    Expanded(
                      child: Center(
                        child: Semantics(
                          button: true,
                          label: 'Добавить растение',
                          child: GestureDetector(
                            onTap: () {
                              HapticFeedback.lightImpact();
                              _showCreateSheet(context);
                            },
                            child: Container(
                              width: 52,
                              height: 38,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(12),
                                gradient: LinearGradient(colors: [c.leaf, Color.lerp(c.leaf, c.water, 0.6)!]),
                              ),
                              child: const Icon(Icons.add_rounded, color: Colors.white, size: 28),
                            ),
                          ),
                        ),
                      ),
                    ),
                    item(2),
                    item(3),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
