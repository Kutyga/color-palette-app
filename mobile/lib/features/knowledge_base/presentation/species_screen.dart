import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../app/theme.dart';
import '../../../shared/widgets.dart';
import '../../care/domain/care_type.dart';
import '../domain/species.dart';

const _monthsShort = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

class SpeciesScreen extends ConsumerWidget {
  const SpeciesScreen({super.key, required this.speciesId});

  final String speciesId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final species = ref.watch(speciesProvider(speciesId));
    return Scaffold(
      appBar: AppBar(),
      body: switch (species) {
        AsyncData(value: final s?) => _SpeciesBody(species: s),
        AsyncData() => const Center(child: EmptyState(icon: Icons.help_outline, title: 'Вид не найден', message: '')),
        AsyncError(:final error) => ErrorView(error),
        _ => const Center(child: CircularProgressIndicator.adaptive()),
      },
    );
  }
}

class _SpeciesBody extends StatelessWidget {
  const _SpeciesBody({required this.species});

  final Species species;

  @override
  Widget build(BuildContext context) {
    final c = context.garden;
    final care = species.care;
    return ListView(
      padding: const EdgeInsets.only(bottom: 48),
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: GardenTheme.gutter),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(species.latinName.toUpperCase(), style: context.text.labelMedium?.copyWith(letterSpacing: 0.4, color: c.leaf)),
              Text(species.name, style: context.text.displaySmall),
              if (species.commonNamesRu.length > 1)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text('Также: ${species.commonNamesRu.skip(1).join(', ')}', style: context.text.bodyMedium?.copyWith(color: c.secondaryLabel)),
                ),
              const SizedBox(height: 20),
              ClipRRect(
                borderRadius: BorderRadius.circular(GardenTheme.radiusLg),
                child: AspectRatio(aspectRatio: 4 / 3, child: PlantThumb(seed: species.slug, radius: 0, iconSize: 96)),
              ),
              if (species.descriptionRu != null) ...[
                const SizedBox(height: 20),
                Text(species.descriptionRu!, style: context.text.bodyLarge),
              ],
            ],
          ),
        ),
        if (species.toxicToPets == true || species.toxicToHumans == true)
          Padding(
            padding: const EdgeInsets.fromLTRB(GardenTheme.gutter, 16, GardenTheme.gutter, 0),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: c.alert.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(GardenTheme.radiusSm)),
              child: Row(
                children: [
                  Icon(Icons.warning_amber_rounded, color: c.alert),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      [
                        if (species.toxicToPets == true) 'ядовито для кошек и собак',
                        if (species.toxicToHumans == true) 'сок раздражает кожу — берегите детей',
                      ].join('; ').replaceFirstMapped(RegExp('^.'), (m) => m[0]!.toUpperCase()),
                      style: context.text.bodyMedium,
                    ),
                  ),
                ],
              ),
            ),
          ),
        if (care != null) ...[
          const SectionHeader('Уход'),
          SizedBox(
            height: 132 + FactTile.extraHeight(context),
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: GardenTheme.gutter),
              children: [
                FactTile(
                  icon: Icons.water_drop_rounded,
                  color: c.water,
                  value: '${care.waterIntervalSummer.round()} / ${care.waterIntervalWinter.round()} дн.',
                  label: 'полив летом / зимой',
                ),
                if (care.light != null) FactTile(icon: Icons.wb_sunny_rounded, color: c.soil, value: care.light!.label, label: 'свет'),
                if (care.humidityMinPct != null) FactTile(icon: Icons.water_rounded, color: c.mist, value: 'от ${care.humidityMinPct}%', label: 'влажность'),
                if (care.tempMinC != null) FactTile(icon: Icons.thermostat_rounded, color: c.soil, value: '${care.tempMinC}…${care.tempMaxC} °C', label: 'температура'),
                if (care.repotEveryYears != null) FactTile(icon: CareType.repot.icon, value: 'раз в ${care.repotEveryYears} г.', label: 'пересадка'),
              ].expand((w) => [w, const SizedBox(width: 10)]).toList(),
            ),
          ),
          _InfoRows(rows: [
            if (care.drynessRu != null) ('Когда поливать', 'когда просохнет ${care.drynessRu}'),
            if (care.fertilizeIntervalDays != null)
              ('Подкормка', 'раз в ${care.fertilizeIntervalDays} дн.'
                  '${care.fertilizeMonths.isEmpty ? '' : ', ${_monthsShort[care.fertilizeMonths.first - 1]}–${_monthsShort[care.fertilizeMonths.last - 1]}'}'),
            if (care.propagation.isNotEmpty) ('Размножение', care.propagation.join(', ')),
            if (species.plantType != null) ('Тип', species.plantType!),
          ]),
          if (care.tipsRu.isNotEmpty) ...[
            const SectionHeader('Советы'),
            for (final t in care.tipsRu)
              ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: GardenTheme.gutter),
                leading: Icon(Icons.eco_rounded, color: c.leaf),
                title: Text(t, style: context.text.bodyMedium),
              ),
          ],
        ],
      ],
    );
  }
}

class _InfoRows extends StatelessWidget {
  const _InfoRows({required this.rows});

  final List<(String, String)> rows;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(GardenTheme.gutter, 12, GardenTheme.gutter, 0),
        child: Card(
          child: Column(
            children: [
              for (final (i, (k, v)) in rows.indexed) ...[
                if (i > 0) const Divider(height: 1, indent: 16),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(width: 130, child: Text(k, style: context.text.bodyMedium?.copyWith(color: context.garden.secondaryLabel))),
                      Expanded(child: Text(v, style: context.text.bodyMedium)),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      );
}
