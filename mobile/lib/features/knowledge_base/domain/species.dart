import '../../care/domain/care_type.dart';

class Species {
  const Species({
    required this.id,
    required this.slug,
    required this.latinName,
    this.commonNamesRu = const [],
    this.synonyms = const [],
    this.descriptionRu,
    this.plantType,
    this.difficulty,
    this.toxicToPets,
    this.toxicToHumans,
    this.airPurifying,
    this.care,
  });

  final String id;
  final String slug;
  final String latinName;
  final List<String> commonNamesRu;
  final List<String> synonyms;
  final String? descriptionRu;
  final String? plantType;
  final int? difficulty;
  final bool? toxicToPets;
  final bool? toxicToHumans;
  final bool? airPurifying;
  final CareProfile? care;

  Map<String, dynamic> toJson() => {
        'id': id,
        'slug': slug,
        'latin_name': latinName,
        'common_names': {'ru': commonNamesRu},
        'synonyms': synonyms,
        'description': {'ru': descriptionRu},
        'plant_type': plantType,
        'difficulty': difficulty,
        'toxic_to_pets': toxicToPets,
        'toxic_to_humans': toxicToHumans,
        'air_purifying': airPurifying,
        'care_profiles': care?.toJson(),
      };

  String get name => commonNamesRu.isNotEmpty ? commonNamesRu.first : latinName;

  bool matches(String query) {
    final q = query.trim().toLowerCase();
    return [latinName, ...commonNamesRu, ...synonyms].any((n) => n.toLowerCase().contains(q));
  }

  /// Ожидает выборку `*, care_profiles(*)`.
  factory Species.fromJson(Map<String, dynamic> json) {
    final care = json['care_profiles'];
    return Species(
      id: json['id'] as String,
      slug: json['slug'] as String,
      latinName: json['latin_name'] as String,
      commonNamesRu: ((json['common_names'] as Map?)?['ru'] as List?)?.cast<String>() ?? const [],
      synonyms: (json['synonyms'] as List?)?.cast<String>() ?? const [],
      descriptionRu: (json['description'] as Map?)?['ru'] as String?,
      plantType: json['plant_type'] as String?,
      difficulty: json['difficulty'] as int?,
      toxicToPets: json['toxic_to_pets'] as bool?,
      toxicToHumans: json['toxic_to_humans'] as bool?,
      airPurifying: json['air_purifying'] as bool?,
      // PostgREST отдаёт связь 1:1 объектом, но на всякий случай поддерживаем и массив.
      care: switch (care) {
        final Map<String, dynamic> m => CareProfile.fromJson(m),
        [final Map<String, dynamic> m, ...] => CareProfile.fromJson(m),
        _ => null,
      },
    );
  }
}

class CareProfile {
  const CareProfile({
    this.light,
    required this.waterIntervalSummer,
    required this.waterIntervalWinter,
    this.drynessRu,
    this.humidityMinPct,
    this.tempMinC,
    this.tempMaxC,
    this.fertilizeIntervalDays,
    this.fertilizeMonths = const [],
    this.repotEveryYears,
    this.propagation = const [],
    this.tipsRu = const [],
  });

  final LightLevel? light;
  final double waterIntervalSummer;
  final double waterIntervalWinter;
  final String? drynessRu;
  final int? humidityMinPct;
  final int? tempMinC;
  final int? tempMaxC;
  final int? fertilizeIntervalDays;
  final List<int> fertilizeMonths;
  final int? repotEveryYears;
  final List<String> propagation;
  final List<String> tipsRu;

  Map<String, dynamic> toJson() => {
        'light': light?.dbName,
        'water_interval_summer': waterIntervalSummer,
        'water_interval_winter': waterIntervalWinter,
        'soil_dryness_before_watering': {'ru': drynessRu},
        'humidity_min_pct': humidityMinPct,
        'temp_min_c': tempMinC,
        'temp_max_c': tempMaxC,
        'fertilize_interval_days': fertilizeIntervalDays,
        'fertilize_months': fertilizeMonths,
        'repot_every_years': repotEveryYears,
        'propagation': propagation,
        'tips': {'ru': tipsRu},
      };

  factory CareProfile.fromJson(Map<String, dynamic> json) => CareProfile(
        light: LightLevel.fromDb(json['light'] as String?),
        waterIntervalSummer: (json['water_interval_summer'] as num).toDouble(),
        waterIntervalWinter: (json['water_interval_winter'] as num).toDouble(),
        drynessRu: (json['soil_dryness_before_watering'] as Map?)?['ru'] as String?,
        humidityMinPct: json['humidity_min_pct'] as int?,
        tempMinC: json['temp_min_c'] as int?,
        tempMaxC: json['temp_max_c'] as int?,
        fertilizeIntervalDays: json['fertilize_interval_days'] as int?,
        fertilizeMonths: (json['fertilize_months'] as List?)?.cast<int>() ?? const [],
        repotEveryYears: json['repot_every_years'] as int?,
        propagation: (json['propagation'] as List?)?.cast<String>() ?? const [],
        tipsRu: ((json['tips'] as Map?)?['ru'] as List?)?.cast<String>() ?? const [],
      );
}
