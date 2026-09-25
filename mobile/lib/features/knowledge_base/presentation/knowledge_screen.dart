import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../app/theme.dart';
import '../../../shared/widgets.dart';
import '../domain/species.dart';

/// База знаний в духе apple.com: крупный поиск, витрина подборок, список видов.
class KnowledgeScreen extends ConsumerStatefulWidget {
  const KnowledgeScreen({super.key});

  @override
  ConsumerState<KnowledgeScreen> createState() => _KnowledgeScreenState();
}

typedef _Collection = ({String title, String subtitle, IconData icon, bool Function(Species) test});

class _KnowledgeScreenState extends ConsumerState<KnowledgeScreen> {
  String _query = '';
  _Collection? _collection;

  static final _collections = <_Collection>[
    (title: 'Неубиваемые', subtitle: 'Для новичков и занятых', icon: Icons.shield_moon_rounded, test: (s) => (s.difficulty ?? 5) <= 1),
    (title: 'Безопасно для кошек', subtitle: 'Не ядовиты для питомцев', icon: Icons.pets_rounded, test: (s) => s.toxicToPets == false),
    (title: 'Очищают воздух', subtitle: 'Зелёные фильтры для дома', icon: Icons.air_rounded, test: (s) => s.airPurifying == true),
    (title: 'Для тёмной квартиры', subtitle: 'Мирятся с полутенью', icon: Icons.nights_stay_rounded, test: (s) => s.care?.light?.dbName == 'medium' || s.care?.light?.dbName == 'low'),
  ];

  @override
  Widget build(BuildContext context) {
    final results = ref.watch(speciesSearchProvider(_query));
    final c = context.garden;
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: CustomScrollView(
          slivers: [
            const SliverToBoxAdapter(child: LargeTitle(overline: 'База знаний', title: 'Растения')),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: GardenTheme.gutter),
                child: SearchBar(
                  hintText: 'Монстера, фикус, тёщин язык…',
                  leading: const Icon(Icons.search_rounded),
                  elevation: const WidgetStatePropertyAll(0),
                  backgroundColor: WidgetStatePropertyAll(c.surfaceMuted),
                  shape: WidgetStatePropertyAll(RoundedRectangleBorder(borderRadius: BorderRadius.circular(GardenTheme.radiusSm))),
                  onChanged: (v) => setState(() => _query = v),
                ),
              ),
            ),
            if (_query.isEmpty) ...[
              const SliverToBoxAdapter(child: SectionHeader('Подборки')),
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 168,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: GardenTheme.gutter),
                    itemCount: _collections.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 12),
                    itemBuilder: (context, i) => _CollectionCard(
                      collection: _collections[i],
                      selected: identical(_collection, _collections[i]),
                      color: [c.leaf, c.water, c.mist, c.soil][i % 4],
                      onTap: () => setState(() => _collection = identical(_collection, _collections[i]) ? null : _collections[i]),
                    ),
                  ),
                ),
              ),
            ],
            SliverToBoxAdapter(child: SectionHeader(_query.isNotEmpty ? 'Результаты' : _collection?.title ?? 'Все виды')),
            switch (results) {
              AsyncData(:final value) => _list(value.where((s) => _query.isNotEmpty || _collection == null || _collection!.test(s)).toList()),
              AsyncError(:final error) => SliverToBoxAdapter(child: ErrorView(error)),
              _ => const SliverToBoxAdapter(child: Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator.adaptive()))),
            },
            const SliverToBoxAdapter(child: SizedBox(height: 120)),
          ],
        ),
      ),
    );
  }

  Widget _list(List<Species> species) {
    if (species.isEmpty) {
      return const SliverToBoxAdapter(
        child: EmptyState(icon: Icons.search_off_rounded, title: 'Ничего не нашли', message: 'Попробуйте другое название или латынь.'),
      );
    }
    return SliverList.builder(
      itemCount: species.length,
      itemBuilder: (context, i) {
        final s = species[i];
        return ListTile(
          contentPadding: const EdgeInsets.symmetric(horizontal: GardenTheme.gutter, vertical: 4),
          leading: PlantThumb(seed: s.slug, size: 52),
          title: Text(s.name, style: context.text.titleMedium),
          subtitle: Text(s.latinName, style: context.text.bodySmall?.copyWith(fontStyle: FontStyle.italic)),
          trailing: _Difficulty(s.difficulty),
          onTap: () => context.push('/species/${s.id}'),
        );
      },
    );
  }
}

class _CollectionCard extends StatelessWidget {
  const _CollectionCard({required this.collection, required this.selected, required this.color, required this.onTap});

  final _Collection collection;
  final bool selected;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOutCubic,
        width: 200,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(GardenTheme.radiusLg),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [color, Color.lerp(color, Colors.black, 0.35)!],
          ),
          border: selected ? Border.all(color: Colors.white, width: 3) : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(collection.icon, color: Colors.white, size: 30),
            const Spacer(),
            Text(collection.title, style: context.text.titleMedium?.copyWith(color: Colors.white)),
            const SizedBox(height: 2),
            Text(collection.subtitle, style: context.text.bodySmall?.copyWith(color: Colors.white70)),
          ],
        ),
      ),
    );
  }
}

class _Difficulty extends StatelessWidget {
  const _Difficulty(this.level);

  final int? level;

  @override
  Widget build(BuildContext context) {
    if (level == null) return const SizedBox.shrink();
    final label = switch (level!) { <= 1 => 'легко', <= 3 => 'средне', _ => 'сложно' };
    return Chip(label: Text(label), visualDensity: VisualDensity.compact);
  }
}
