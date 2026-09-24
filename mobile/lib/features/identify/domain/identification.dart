import 'dart:typed_data';

import 'package:image/image.dart' as img;

import '../../knowledge_base/domain/species.dart';

/// Кандидат распознавания: латинское название из модели и, если нашлось, вид из базы знаний.
class IdentificationCandidate {
  const IdentificationCandidate({required this.latinName, required this.score, this.species, this.genusOnly = false});

  final String latinName;

  /// Уверенность модели 0…1.
  final double score;

  /// Вид из базы знаний: точное совпадение или (если [genusOnly]) вид того же рода.
  final Species? species;
  final bool genusOnly;

  int get percent => (score * 100).round();
}

/// Метки модели AIY plants V1: CSV «id,name», строка с индексом 0 — «background».
List<String> parseLabels(String csv) {
  final labels = <int, String>{};
  for (final line in csv.split('\n').skip(1)) {
    final comma = line.indexOf(',');
    if (comma <= 0) continue;
    final id = int.tryParse(line.substring(0, comma).trim());
    if (id != null) labels[id] = line.substring(comma + 1).trim();
  }
  final size = labels.isEmpty ? 0 : labels.keys.reduce((a, b) => a > b ? a : b) + 1;
  return List.generate(size, (i) => labels[i] ?? '');
}

/// Фото → квадрат по центру → size×size → байты RGB подряд (формат входа модели).
Uint8List preprocessRgb(Uint8List encoded, {int size = 224}) {
  img.Image? decoded;
  try {
    decoded = img.decodeImage(encoded);
  } catch (_) {
    decoded = null; // повреждённый файл: библиотека бросает внутренние ошибки
  }
  if (decoded == null) throw const FormatException('Не удалось прочитать изображение');
  final oriented = img.bakeOrientation(decoded);
  final side = oriented.width < oriented.height ? oriented.width : oriented.height;
  final square = img.copyCrop(
    oriented,
    x: (oriented.width - side) ~/ 2,
    y: (oriented.height - side) ~/ 2,
    width: side,
    height: side,
  );
  final resized = img.copyResize(square, width: size, height: size, interpolation: img.Interpolation.average);
  final out = Uint8List(size * size * 3);
  var i = 0;
  for (final p in resized) {
    out[i++] = p.r.toInt();
    out[i++] = p.g.toInt();
    out[i++] = p.b.toInt();
  }
  return out;
}

/// Лучшие k меток, без «background» и совсем неуверенных вариантов.
List<({String label, double score})> topPredictions(List<double> scores, List<String> labels, {int k = 5, double minScore = 0.03}) {
  final ranked = [
    for (var i = 0; i < scores.length && i < labels.length; i++)
      if (labels[i].isNotEmpty && labels[i].toLowerCase() != 'background' && scores[i] >= minScore) (label: labels[i], score: scores[i]),
  ]..sort((a, b) => b.score.compareTo(a.score));
  return ranked.take(k).toList();
}

/// Сопоставляет латинское название с базой знаний: сначала точное (с синонимами), потом по роду.
IdentificationCandidate matchSpecies(String latinName, double score, List<Species> knowledgeBase) {
  final name = _normalize(latinName);
  for (final s in knowledgeBase) {
    if ([s.latinName, ...s.synonyms].map(_normalize).contains(name)) {
      return IdentificationCandidate(latinName: latinName, score: score, species: s);
    }
  }
  final genus = name.split(' ').first;
  for (final s in knowledgeBase) {
    if ([s.latinName, ...s.synonyms].any((n) => _normalize(n).split(' ').first == genus)) {
      return IdentificationCandidate(latinName: latinName, score: score, species: s, genusOnly: true);
    }
  }
  return IdentificationCandidate(latinName: latinName, score: score);
}

String _normalize(String s) => s.toLowerCase().replaceAll('×', ' ').replaceAll(RegExp(r'\s+'), ' ').trim();

/// Первая буква заглавная: «monstera deliciosa» → «Monstera deliciosa».
String capitalizeLatin(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
