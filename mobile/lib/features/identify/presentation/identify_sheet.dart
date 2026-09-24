import 'package:flutter/material.dart';

import '../../../app/theme.dart';
import '../../../shared/widgets.dart';
import '../domain/identification.dart';

/// Результаты распознавания: вид из базы знаний, если он есть, иначе латинское название.
Future<IdentificationCandidate?> showIdentificationResults(BuildContext context, List<IdentificationCandidate> candidates) =>
    showModalBottomSheet<IdentificationCandidate>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (sheet) => _ResultsSheet(candidates: candidates),
    );

class _ResultsSheet extends StatelessWidget {
  const _ResultsSheet({required this.candidates});

  final List<IdentificationCandidate> candidates;

  @override
  Widget build(BuildContext context) {
    final c = context.garden;
    if (candidates.isEmpty) {
      return const Padding(
        padding: EdgeInsets.only(bottom: 32),
        child: EmptyState(
          icon: Icons.help_outline_rounded,
          title: 'Не удалось узнать растение',
          message: 'Снимите лист или цветок крупно при хорошем свете — или выберите вид вручную.',
        ),
      );
    }
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(GardenTheme.gutter, 0, GardenTheme.gutter, 4),
            child: Text('Похоже на', style: context.text.titleLarge),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(GardenTheme.gutter, 0, GardenTheme.gutter, 8),
            child: Text(
              'Распознавание работает на телефоне и бесплатно, но не всегда точно — проверьте по фото в базе знаний.',
              style: context.text.bodySmall,
            ),
          ),
          for (final cand in candidates)
            ListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: GardenTheme.gutter, vertical: 2),
              leading: ProgressRing(
                progress: cand.score,
                color: cand.species != null && !cand.genusOnly ? c.leaf : c.water,
                size: 44,
                stroke: 5,
                child: Text('${cand.percent}%', style: context.text.labelMedium?.copyWith(fontSize: 11)),
              ),
              title: Text(
                cand.species != null && !cand.genusOnly ? cand.species!.name : capitalizeLatin(cand.latinName),
                style: context.text.titleMedium,
              ),
              subtitle: Text(
                cand.species == null
                    ? 'Нет в базе знаний — добавим с этим названием'
                    : cand.genusOnly
                        ? 'Род ${cand.species!.latinName.split(' ').first} — уточните вид'
                        : capitalizeLatin(cand.latinName),
                style: context.text.bodySmall?.copyWith(fontStyle: FontStyle.italic),
              ),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () => Navigator.pop(context, cand),
            ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }
}
