import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../app/theme.dart';
import '../../../shared/widgets.dart';
import '../domain/plant.dart';

/// Коллекция в духе профиля Instagram: счётчики, фильтр по местам, сетка 3×N.
class CollectionScreen extends ConsumerStatefulWidget {
  const CollectionScreen({super.key});

  @override
  ConsumerState<CollectionScreen> createState() => _CollectionScreenState();
}

class _CollectionScreenState extends ConsumerState<CollectionScreen> {
  String? _locationFilter;

  @override
  Widget build(BuildContext context) {
    final plants = ref.watch(myPlantsProvider);
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: switch (plants) {
          AsyncData(:final value) => _content(context, value),
          AsyncError(:final error) => ErrorView(error, onRetry: () => ref.invalidate(myPlantsProvider)),
          _ => const Center(child: CircularProgressIndicator.adaptive()),
        },
      ),
    );
  }

  Widget _content(BuildContext context, List<Plant> plants) {
    final now = DateTime.now();
    final locations = {for (final p in plants) if (p.locationName != null) p.locationName!}.toList()..sort();
    final visible = _locationFilter == null ? plants : plants.where((p) => p.locationName == _locationFilter).toList();
    final needCare = plants.where((p) => plantStatus(p.nextWaterAt, now) != PlantStatus.ok).length;

    return CustomScrollView(
      slivers: [
        const SliverToBoxAdapter(child: LargeTitle(overline: 'Мой сад', title: 'Коллекция')),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: GardenTheme.gutter),
            child: Row(
              children: [
                _Stat(value: '${plants.length}', label: plural(plants.length, 'растение', 'растения', 'растений')),
                _Stat(value: '${locations.length}', label: plural(locations.length, 'место', 'места', 'мест')),
                _Stat(value: '$needCare', label: 'ждут ухода'),
              ],
            ),
          ),
        ),
        if (locations.length > 1)
          SliverToBoxAdapter(
            child: SizedBox(
              height: 56,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(GardenTheme.gutter, 12, GardenTheme.gutter, 4),
                children: [
                  for (final name in [null, ...locations])
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(name ?? 'Все'),
                        selected: _locationFilter == name,
                        showCheckmark: false,
                        onSelected: (_) => setState(() => _locationFilter = name),
                      ),
                    ),
                ],
              ),
            ),
          ),
        if (plants.isEmpty)
          SliverFillRemaining(
            hasScrollBody: false,
            child: Center(
              child: EmptyState(
                icon: Icons.local_florist_outlined,
                title: 'Здесь будет ваш сад',
                message: 'Добавьте первое растение — мы подскажем, как за ним ухаживать, и напомним о поливе.',
                action: FilledButton.icon(
                  onPressed: () => context.push('/add'),
                  icon: const Icon(Icons.add_rounded),
                  label: const Text('Добавить растение'),
                ),
              ),
            ),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(GardenTheme.gutter, 12, GardenTheme.gutter, 120),
            sliver: SliverGrid.builder(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                mainAxisSpacing: 12,
                crossAxisSpacing: 10,
                childAspectRatio: 0.72,
              ),
              itemCount: visible.length,
              itemBuilder: (context, i) => _PlantTile(plant: visible[i], now: now),
            ),
          ),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) => Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(value, style: context.text.headlineSmall),
            Text(label, style: context.text.labelMedium),
          ],
        ),
      );
}

class _PlantTile extends StatelessWidget {
  const _PlantTile({required this.plant, required this.now});

  final Plant plant;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final status = plantStatus(plant.nextWaterAt, now);
    final statusColor = status.color(context.garden);
    return Semantics(
      button: true,
      label: '${plant.nickname}, ${status.label}',
      child: GestureDetector(
        onTap: () => context.push('/plant/${plant.id}'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Stack(
                children: [
                  Positioned.fill(
                    child: Hero(
                      tag: 'plant-${plant.id}',
                      child: PlantThumb(seed: plant.id, radius: GardenTheme.radiusMd - 4, photoUrl: plant.photoUrl, photoBytes: plant.photoBytes),
                    ),
                  ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Container(
                      width: 12,
                      height: 12,
                      decoration: BoxDecoration(
                        color: statusColor,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 6),
            Text(plant.nickname, style: context.text.bodyMedium?.copyWith(fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
            Row(
              children: [
                if (plant.nextWaterAt != null) ...[
                  Icon(Icons.water_drop_rounded, size: 13, color: status == PlantStatus.ok ? context.garden.secondaryLabel : statusColor),
                  const SizedBox(width: 3),
                ],
                Expanded(
                  child: Text(
                    plant.nextWaterAt == null ? (plant.speciesName ?? '') : relativeDay(plant.nextWaterAt!, now),
                    style: context.text.labelMedium?.copyWith(color: status == PlantStatus.ok ? null : statusColor),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
