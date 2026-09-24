import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../app/providers.dart';
import '../../app/theme.dart';
import '../../shared/widgets.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final demo = ref.watch(demoModeProvider);
    final plants = ref.watch(myPlantsProvider).value ?? const [];
    final email = demo ? null : Supabase.instance.client.auth.currentUser?.email;
    final c = context.garden;

    return Scaffold(
      appBar: AppBar(title: const Text('Профиль')),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: GardenTheme.gutter),
        children: [
          const SizedBox(height: 12),
          Row(
            children: [
              CircleAvatar(radius: 40, backgroundColor: c.leaf.withValues(alpha: 0.15), child: Icon(Icons.person_rounded, size: 44, color: c.leaf)),
              const SizedBox(width: 20),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(demo ? 'Гость' : (email ?? 'Садовник'), style: context.text.titleLarge, overflow: TextOverflow.ellipsis),
                    Text('${plants.length} ${plural(plants.length, 'растение', 'растения', 'растений')}', style: context.text.bodyMedium?.copyWith(color: c.secondaryLabel)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          if (demo)
            Card(
              color: c.water.withValues(alpha: 0.1),
              child: const ListTile(
                leading: Icon(Icons.science_outlined),
                title: Text('Демо-режим'),
                subtitle: Text('Данные хранятся только на устройстве до перезапуска. Для синхронизации соберите приложение с config/dev.json.'),
              ),
            ),
          const SizedBox(height: 12),
          Card(
            child: Column(
              children: const [
                ListTile(leading: Icon(Icons.notifications_active_outlined), title: Text('Напоминания'), trailing: Text('09:00')),
                Divider(height: 1, indent: 56),
                ListTile(leading: Icon(Icons.lock_outline_rounded), title: Text('Приватность по умолчанию'), trailing: Text('Подписчики')),
              ],
            ),
          ),
          const SizedBox(height: 12),
          if (!demo)
            Card(
              child: ListTile(
                leading: Icon(Icons.logout_rounded, color: c.alert),
                title: Text('Выйти', style: TextStyle(color: c.alert)),
                onTap: () => Supabase.instance.client.auth.signOut(),
              ),
            ),
        ],
      ),
    );
  }
}
