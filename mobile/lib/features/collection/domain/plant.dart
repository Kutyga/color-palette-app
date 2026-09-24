import 'dart:typed_data';

import '../../care/domain/care_type.dart';

enum PlantVisibility {
  private('private', 'Только я'),
  followers('followers', 'Подписчики'),
  public('public', 'Все');

  const PlantVisibility(this.dbName, this.label);

  final String dbName;
  final String label;

  static PlantVisibility fromDb(String value) => values.firstWhere((v) => v.dbName == value);
}

class Location {
  const Location({required this.id, required this.name, this.lightLevel, this.isOutdoor = false});

  final String id;
  final String name;
  final LightLevel? lightLevel;
  final bool isOutdoor;

  factory Location.fromJson(Map<String, dynamic> json) => Location(
        id: json['id'] as String,
        name: json['name'] as String,
        lightLevel: LightLevel.fromDb(json['light_level'] as String?),
        isOutdoor: json['is_outdoor'] as bool? ?? false,
      );
}

class Plant {
  const Plant({
    required this.id,
    required this.nickname,
    this.speciesId,
    this.speciesName,
    this.locationId,
    this.locationName,
    this.lightLevel,
    this.potMaterial,
    this.visibility = PlantVisibility.followers,
    this.notes,
    this.nextWaterAt,
    this.photoUrl,
    this.photoBytes,
  });

  final String id;
  final String nickname;
  final String? speciesId;
  final String? speciesName;
  final String? locationId;
  final String? locationName;
  final LightLevel? lightLevel;
  final PotMaterial? potMaterial;
  final PlantVisibility visibility;
  final String? notes;

  /// Денормализовано из графика полива — для статуса в списке коллекции.
  final DateTime? nextWaterAt;

  /// Обложка: подписанная ссылка из Storage или байты (демо-режим).
  final String? photoUrl;
  final Uint8List? photoBytes;

  /// Путь обложки в бакете plant-photos — чтобы получить подписанную ссылку.
  static String? coverPathOf(Map<String, dynamic> json) => (json['cover'] as Map?)?['storage_path'] as String?;

  /// Ожидает выборку вида
  /// `*, species(latin_name, common_names), locations(name, light_level), care_schedules(type, next_due_at),
  /// cover:plant_photos!plants_cover_photo_fk(storage_path)`.
  factory Plant.fromJson(Map<String, dynamic> json, {String? photoUrl}) {
    final species = json['species'] as Map<String, dynamic>?;
    final location = json['locations'] as Map<String, dynamic>?;
    final schedules = (json['care_schedules'] as List?)?.cast<Map<String, dynamic>>() ?? const [];
    final water = schedules.where((s) => s['type'] == 'water' && s['next_due_at'] != null);
    return Plant(
      id: json['id'] as String,
      nickname: json['nickname'] as String,
      speciesId: json['species_id'] as String?,
      speciesName: species == null ? null : speciesDisplayName(species),
      locationId: json['location_id'] as String?,
      locationName: location?['name'] as String?,
      lightLevel: LightLevel.fromDb(location?['light_level'] as String?),
      potMaterial: PotMaterial.fromDb(json['pot_material'] as String?),
      visibility: PlantVisibility.fromDb(json['visibility'] as String? ?? 'followers'),
      notes: json['notes'] as String?,
      nextWaterAt: water.isEmpty ? null : DateTime.parse(water.first['next_due_at'] as String).toLocal(),
      photoUrl: photoUrl,
    );
  }
}

/// Русское народное название, если есть, иначе латинское.
String speciesDisplayName(Map<String, dynamic> species) {
  final ru = (species['common_names'] as Map?)?['ru'] as List?;
  return ru != null && ru.isNotEmpty ? ru.first as String : species['latin_name'] as String;
}

/// Черновик нового растения с формы добавления.
class NewPlant {
  const NewPlant({
    required this.nickname,
    this.speciesId,
    this.locationId,
    this.potMaterial,
    this.visibility = PlantVisibility.followers,
    this.waterIntervalDays,
    this.lastWateredAt,
    this.notes,
  });

  final String nickname;
  final String? speciesId;
  final String? locationId;
  final PotMaterial? potMaterial;
  final PlantVisibility visibility;

  /// Если null — берётся из базы знаний по виду, иначе 7 дней.
  final double? waterIntervalDays;
  final DateTime? lastWateredAt;
  final String? notes;
}
