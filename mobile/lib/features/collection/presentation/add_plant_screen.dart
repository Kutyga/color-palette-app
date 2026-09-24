import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../app/theme.dart';
import '../../../shared/widgets.dart';
import '../../care/domain/care_interval_calculator.dart';
import '../../care/domain/care_type.dart';
import '../../knowledge_base/domain/species.dart';
import '../domain/plant.dart';

/// Добавление растения: минимум полей, умные значения по умолчанию из базы знаний.
class AddPlantScreen extends ConsumerStatefulWidget {
  const AddPlantScreen({super.key});

  @override
  ConsumerState<AddPlantScreen> createState() => _AddPlantScreenState();
}

class _AddPlantScreenState extends ConsumerState<AddPlantScreen> {
  final _name = TextEditingController();
  Species? _species;
  String? _locationId;
  PotMaterial? _pot = PotMaterial.plastic;
  int _wateredDaysAgo = 0;
  PlantVisibility _visibility = PlantVisibility.followers;
  bool _saving = false;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _pickSpecies() async {
    final picked = await showModalBottomSheet<Species>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (_) => const _SpeciesPicker(),
    );
    if (picked == null) return;
    setState(() {
      _species = picked;
      if (_name.text.trim().isEmpty) _name.text = picked.name;
    });
  }

  Future<void> _addLocation() async {
    final result = await showDialog<(String, LightLevel?)>(context: context, builder: (_) => const _NewLocationDialog());
    if (result == null) return;
    final location = await ref.read(gardenRepositoryProvider).addLocation(result.$1, result.$2);
    ref.invalidate(myLocationsProvider);
    setState(() => _locationId = location.id);
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    if (name.isEmpty) return;
    setState(() => _saving = true);
    try {
      final plant = await ref.read(gardenRepositoryProvider).addPlant(NewPlant(
            nickname: name,
            speciesId: _species?.id,
            locationId: _locationId,
            potMaterial: _pot,
            visibility: _visibility,
            lastWateredAt: DateTime.now().subtract(Duration(days: _wateredDaysAgo)),
          ));
      HapticFeedback.mediumImpact();
      ref.refreshCollection();
      if (mounted) context.pushReplacement('/plant/${plant.id}');
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Не удалось сохранить: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final locations = ref.watch(myLocationsProvider).value ?? const [];
    final care = _species?.care;
    final c = context.garden;

    return Scaffold(
      appBar: AppBar(
        leading: TextButton(onPressed: () => context.pop(), child: const Text('Отмена')),
        leadingWidth: 96,
        title: const Text('Новое растение'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(GardenTheme.gutter, 8, GardenTheme.gutter, 32),
        children: [
          Center(child: PlantThumb(seed: _name.text.isEmpty ? 'new' : _name.text, size: 120, radius: GardenTheme.radiusLg)),
          const SizedBox(height: 8),
          Center(
            child: TextButton.icon(
              onPressed: null, // Съёмка и распознавание по фото — этап v1.2.
              icon: const Icon(Icons.photo_camera_outlined),
              label: const Text('Фото и распознавание — скоро'),
            ),
          ),
          const SizedBox(height: 16),
          _Label('Вид'),
          Card(
            child: ListTile(
              leading: Icon(Icons.search_rounded, color: c.leaf),
              title: Text(_species?.name ?? 'Выбрать из базы знаний'),
              subtitle: _species == null ? null : Text(_species!.latinName, style: const TextStyle(fontStyle: FontStyle.italic)),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: _pickSpecies,
            ),
          ),
          if (care != null)
            Padding(
              padding: const EdgeInsets.only(top: 8, left: 4),
              child: Text(
                'Полив примерно раз в ${CareIntervalCalculator.baseWaterInterval(care.waterIntervalSummer).round()} дн., '
                'летом чаще, зимой реже. ${care.light != null ? 'Свет: ${care.light!.label.toLowerCase()}.' : ''}',
                style: context.text.bodySmall,
              ),
            ),
          const SizedBox(height: 20),
          _Label('Имя'),
          TextField(
            controller: _name,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(hintText: 'Например, Монстера Мося'),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 20),
          _Label('Где стоит'),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final l in locations)
                ChoiceChip(
                  label: Text(l.name),
                  selected: _locationId == l.id,
                  showCheckmark: false,
                  onSelected: (_) => setState(() => _locationId = l.id),
                ),
              ActionChip(avatar: const Icon(Icons.add_rounded, size: 18), label: const Text('Новое место'), onPressed: _addLocation),
            ],
          ),
          const SizedBox(height: 20),
          _Label('Горшок'),
          SegmentedButton<PotMaterial>(
            showSelectedIcon: false,
            segments: [
              for (final m in [PotMaterial.plastic, PotMaterial.ceramic, PotMaterial.terracotta])
                ButtonSegment(value: m, label: Text(m.label)),
            ],
            selected: {_pot ?? PotMaterial.plastic},
            onSelectionChanged: (s) => setState(() => _pot = s.first),
          ),
          const SizedBox(height: 20),
          _Label('Последний полив'),
          Wrap(
            spacing: 8,
            children: [
              for (final (days, label) in [(0, 'Сегодня'), (2, '2 дня назад'), (5, '5 дней назад'), (10, 'Давно')])
                ChoiceChip(
                  label: Text(label),
                  selected: _wateredDaysAgo == days,
                  showCheckmark: false,
                  onSelected: (_) => setState(() => _wateredDaysAgo = days),
                ),
            ],
          ),
          const SizedBox(height: 20),
          _Label('Кто видит'),
          SegmentedButton<PlantVisibility>(
            showSelectedIcon: false,
            segments: [for (final v in PlantVisibility.values) ButtonSegment(value: v, label: Text(v.label))],
            selected: {_visibility},
            onSelectionChanged: (s) => setState(() => _visibility = s.first),
          ),
          const SizedBox(height: 32),
          FilledButton(
            onPressed: _saving || _name.text.trim().isEmpty ? null : _save,
            child: _saving ? const SizedBox.square(dimension: 22, child: CircularProgressIndicator(strokeWidth: 2.5)) : const Text('Добавить в коллекцию'),
          ),
        ],
      ),
    );
  }
}

class _Label extends StatelessWidget {
  const _Label(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(left: 4, bottom: 8),
        child: Text(text, style: context.text.labelMedium),
      );
}

class _SpeciesPicker extends ConsumerStatefulWidget {
  const _SpeciesPicker();

  @override
  ConsumerState<_SpeciesPicker> createState() => _SpeciesPickerState();
}

class _SpeciesPickerState extends ConsumerState<_SpeciesPicker> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final results = ref.watch(speciesSearchProvider(_query));
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: GardenTheme.gutter),
          child: TextField(
            autofocus: true,
            decoration: const InputDecoration(prefixIcon: Icon(Icons.search_rounded), hintText: 'Название: монстера, фикус…'),
            onChanged: (v) => setState(() => _query = v),
          ),
        ),
        const SizedBox(height: 8),
        Expanded(
          child: switch (results) {
            AsyncData(:final value) when value.isEmpty =>
              const EmptyState(icon: Icons.search_off_rounded, title: 'Ничего не нашли', message: 'Попробуйте латинское название.'),
            AsyncData(:final value) => ListView(
                children: [
                  for (final s in value)
                    ListTile(
                      leading: ClipRRect(borderRadius: BorderRadius.circular(10), child: PlantThumb(seed: s.slug, size: 44)),
                      title: Text(s.name),
                      subtitle: Text(s.latinName, style: const TextStyle(fontStyle: FontStyle.italic)),
                      onTap: () => Navigator.pop(context, s),
                    ),
                ],
              ),
            AsyncError(:final error) => ErrorView(error),
            _ => const Center(child: CircularProgressIndicator.adaptive()),
          },
        ),
      ],
    );
  }
}

class _NewLocationDialog extends StatefulWidget {
  const _NewLocationDialog();

  @override
  State<_NewLocationDialog> createState() => _NewLocationDialogState();
}

class _NewLocationDialogState extends State<_NewLocationDialog> {
  final _name = TextEditingController();
  LightLevel _light = LightLevel.brightIndirect;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: const Text('Новое место'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(controller: _name, autofocus: true, decoration: const InputDecoration(hintText: 'Гостиная, южное окно')),
            const SizedBox(height: 16),
            Text('Освещение', style: context.text.labelMedium),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final l in LightLevel.values)
                  ChoiceChip(label: Text(l.label), selected: _light == l, showCheckmark: false, onSelected: (_) => setState(() => _light = l)),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Отмена')),
          TextButton(
            onPressed: () {
              if (_name.text.trim().isEmpty) return;
              Navigator.pop(context, (_name.text.trim(), _light));
            },
            child: const Text('Добавить'),
          ),
        ],
      );
}
