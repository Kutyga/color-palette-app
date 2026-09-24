import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../app/providers.dart';
import '../../../app/theme.dart';
import '../../../shared/widgets.dart';
import '../../care/domain/care_models.dart';
import '../../care/domain/care_type.dart';
import '../../knowledge_base/domain/species.dart';

/// Карточка растения как страница продукта apple.com: большое фото,
/// крупное имя, факты плашками, одна главная кнопка.
class PlantScreen extends ConsumerWidget {
  const PlantScreen({super.key, required this.plantId});

  final String plantId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final details = ref.watch(plantDetailsProvider(plantId));
    return Scaffold(
      body: switch (details) {
        AsyncData(:final value) => _PlantBody(details: value),
        AsyncError(:final error) => ErrorView(error, onRetry: () => ref.invalidate(plantDetailsProvider(plantId))),
        _ => const Center(child: CircularProgressIndicator.adaptive()),
      },
    );
  }
}

class _PlantBody extends ConsumerWidget {
  const _PlantBody({required this.details});

  final PlantDetails details;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final plant = details.plant;
    final species = plant.speciesId == null ? null : ref.watch(speciesProvider(plant.speciesId!)).value;
    final water = details.scheduleFor(CareType.water);
    final now = DateTime.now();
    final c = context.garden;

    return CustomScrollView(
      slivers: [
        SliverAppBar(
          expandedHeight: 380,
          stretch: true,
          pinned: true,
          backgroundColor: Theme.of(context).scaffoldBackgroundColor,
          leading: const _GlassButton(icon: Icons.arrow_back_ios_new_rounded, isBack: true),
          actions: [
            _GlassButton(
              icon: Icons.more_horiz_rounded,
              onTap: () => _showMenu(context, ref),
            ),
            const SizedBox(width: 8),
          ],
          flexibleSpace: FlexibleSpaceBar(
            stretchModes: const [StretchMode.zoomBackground],
            background: Hero(tag: 'plant-${plant.id}', child: PlantThumb(seed: plant.id, radius: 0, iconSize: 120)),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(GardenTheme.gutter, 20, GardenTheme.gutter, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (plant.speciesName != null)
                  Text(plant.speciesName!.toUpperCase(), style: context.text.labelMedium?.copyWith(letterSpacing: 0.4, color: c.leaf)),
                Text(plant.nickname, style: context.text.displaySmall),
                if (plant.locationName != null) ...[
                  const SizedBox(height: 4),
                  Text(plant.locationName!, style: context.text.bodyLarge?.copyWith(color: c.secondaryLabel)),
                ],
              ],
            ),
          ),
        ),
        SliverToBoxAdapter(child: _Facts(water: water, species: species, now: now)),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(GardenTheme.gutter, 8, GardenTheme.gutter, 0),
            child: FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: c.water),
              onPressed: () async {
                HapticFeedback.mediumImpact();
                await ref.logCare(plant.id, CareType.water);
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Полив отмечен: ${plant.nickname}')));
                }
              },
              icon: const Icon(Icons.water_drop_rounded),
              label: const Text('Полить'),
            ),
          ),
        ),
        const SliverToBoxAdapter(child: SectionHeader('График ухода')),
        SliverList.list(
          children: [
            for (final s in details.schedules) _ScheduleRow(schedule: s, plantId: plant.id, now: now),
          ],
        ),
        if (species?.care != null) ...[
          const SliverToBoxAdapter(child: SectionHeader('Советы')),
          SliverToBoxAdapter(child: _Tips(species: species!)),
        ],
        const SliverToBoxAdapter(child: SectionHeader('Журнал')),
        if (details.events.isEmpty)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: GardenTheme.gutter),
              child: Text('Пока пусто — отметьте первый полив.', style: context.text.bodyMedium?.copyWith(color: c.secondaryLabel)),
            ),
          )
        else
          SliverList.list(
            children: [
              for (final e in details.events.take(20))
                ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: GardenTheme.gutter),
                  leading: Icon(e.type.icon, color: c.forCare(e.type)),
                  title: Text(e.type.label),
                  trailing: Text(DateFormat('d MMM, HH:mm', 'ru').format(e.performedAt), style: context.text.labelMedium),
                ),
            ],
          ),
        const SliverToBoxAdapter(child: SizedBox(height: 48)),
      ],
    );
  }

  void _showMenu(BuildContext context, WidgetRef ref) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheet) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (details.plant.speciesId != null)
              ListTile(
                leading: const Icon(Icons.menu_book_rounded),
                title: const Text('О виде'),
                onTap: () {
                  Navigator.pop(sheet);
                  context.push('/species/${details.plant.speciesId}');
                },
              ),
            ListTile(
              leading: Icon(Icons.delete_outline_rounded, color: context.garden.alert),
              title: Text('Удалить из коллекции', style: TextStyle(color: context.garden.alert)),
              onTap: () async {
                Navigator.pop(sheet);
                await ref.read(gardenRepositoryProvider).deletePlant(details.plant.id);
                ref.refreshCollection();
                if (context.mounted) context.pop();
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _GlassButton extends StatelessWidget {
  const _GlassButton({required this.icon, this.onTap, this.isBack = false});

  final IconData icon;
  final VoidCallback? onTap;
  final bool isBack;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.all(6),
        child: IconButton(
          tooltip: isBack ? 'Назад' : 'Ещё',
          style: IconButton.styleFrom(backgroundColor: Colors.black.withValues(alpha: 0.25), foregroundColor: Colors.white),
          onPressed: onTap ?? () => context.pop(),
          icon: Icon(icon, size: 20),
        ),
      );
}

class _Facts extends StatelessWidget {
  const _Facts({required this.water, required this.species, required this.now});

  final CareSchedule? water;
  final Species? species;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final c = context.garden;
    final care = species?.care;
    final next = water?.nextDueAt;
    return SizedBox(
      height: 132 + FactTile.extraHeight(context) + 28,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(GardenTheme.gutter, 16, GardenTheme.gutter, 12),
        children: [
          if (next != null)
            FactTile(
              icon: Icons.water_drop_rounded,
              color: plantStatus(next, now).color(c),
              value: relativeDay(next, now),
              label: 'следующий полив',
            ),
          if (care?.light != null) FactTile(icon: Icons.wb_sunny_rounded, color: c.soil, value: care!.light!.label, label: 'свет'),
          if (care?.humidityMinPct != null)
            FactTile(icon: Icons.water_rounded, color: c.mist, value: 'от ${care!.humidityMinPct}%', label: 'влажность'),
          if (care?.tempMinC != null)
            FactTile(icon: Icons.thermostat_rounded, color: c.soil, value: '${care!.tempMinC}…${care.tempMaxC} °C', label: 'температура'),
          if (species?.toxicToPets != null)
            FactTile(
              icon: Icons.pets_rounded,
              color: species!.toxicToPets! ? c.alert : c.leaf,
              value: species!.toxicToPets! ? 'Ядовито' : 'Безопасно',
              label: 'для питомцев',
            ),
        ].expand((w) => [w, const SizedBox(width: 10)]).toList(),
      ),
    );
  }
}

class _ScheduleRow extends ConsumerWidget {
  const _ScheduleRow({required this.schedule, required this.plantId, required this.now});

  final CareSchedule schedule;
  final String plantId;
  final DateTime now;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final color = context.garden.forCare(schedule.type);
    final next = schedule.nextDueAt;
    final days = schedule.intervalDays;
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: GardenTheme.gutter),
      leading: CircleAvatar(backgroundColor: color.withValues(alpha: 0.14), child: Icon(schedule.type.icon, color: color, size: 20)),
      title: Text(schedule.type.label),
      subtitle: Text(
        'каждые ${days.toStringAsFixed(days.truncateToDouble() == days ? 0 : 1)} дн.'
        '${schedule.autoAdjust && schedule.type == CareType.water ? ' · с учётом сезона' : ''}',
        style: context.text.bodySmall,
      ),
      trailing: TextButton(
        onPressed: () => ref.logCare(plantId, schedule.type),
        child: Text(next == null ? 'Отметить' : relativeDay(next, now)),
      ),
    );
  }
}

class _Tips extends StatelessWidget {
  const _Tips({required this.species});

  final Species species;

  @override
  Widget build(BuildContext context) {
    final care = species.care!;
    final tips = [
      if (care.drynessRu != null) 'Поливайте, когда просохнет ${care.drynessRu}.',
      ...care.tipsRu,
    ];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: GardenTheme.gutter),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final t in tips)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.eco_rounded, size: 18, color: context.garden.leaf),
                      const SizedBox(width: 10),
                      Expanded(child: Text(t, style: context.text.bodyMedium)),
                    ],
                  ),
                ),
              TextButton(
                onPressed: () => context.push('/species/${species.id}'),
                child: Text('Всё о виде «${species.name}»'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
