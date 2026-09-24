import 'package:flutter/material.dart';

/// Вид ухода. [dbName] совпадает с enum `care_type` в Postgres.
enum CareType {
  water('water', 'Полив', 'Полить', Icons.water_drop_outlined),
  fertilize('fertilize', 'Подкормка', 'Подкормить', Icons.science_outlined),
  mist('mist', 'Опрыскивание', 'Опрыскать', Icons.shower_outlined),
  repot('repot', 'Пересадка', 'Пересадить', Icons.yard_outlined),
  prune('prune', 'Обрезка', 'Обрезать', Icons.content_cut),
  rotate('rotate', 'Поворот', 'Повернуть', Icons.rotate_right),
  cleanLeaves('clean_leaves', 'Чистка листьев', 'Протереть листья', Icons.cleaning_services_outlined),
  treatPests('treat_pests', 'Обработка', 'Обработать', Icons.bug_report_outlined);

  const CareType(this.dbName, this.label, this.action, this.icon);

  final String dbName;
  final String label;
  final String action;
  final IconData icon;

  static CareType fromDb(String value) => values.firstWhere((t) => t.dbName == value);
}

enum LightLevel {
  low('low', 'Тень'),
  medium('medium', 'Полутень'),
  brightIndirect('bright_indirect', 'Яркий рассеянный'),
  direct('direct', 'Прямое солнце');

  const LightLevel(this.dbName, this.label);

  final String dbName;
  final String label;

  static LightLevel? fromDb(String? value) =>
      value == null ? null : values.firstWhere((l) => l.dbName == value);
}

enum PotMaterial {
  plastic('plastic', 'Пластик'),
  ceramic('ceramic', 'Керамика'),
  terracotta('terracotta', 'Терракота'),
  glass('glass', 'Стекло'),
  other('other', 'Другое');

  const PotMaterial(this.dbName, this.label);

  final String dbName;
  final String label;

  static PotMaterial? fromDb(String? value) =>
      value == null ? null : values.firstWhere((m) => m.dbName == value);
}

enum Hemisphere { north, south }
