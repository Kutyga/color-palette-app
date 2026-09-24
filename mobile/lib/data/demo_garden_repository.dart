import 'package:uuid/uuid.dart';

import '../features/care/domain/care_interval_calculator.dart';
import '../features/care/domain/care_models.dart';
import '../features/care/domain/care_type.dart';
import '../features/collection/domain/plant.dart';
import '../features/knowledge_base/domain/species.dart';
import 'demo_species.dart';
import 'garden_repository.dart';
import 'supabase_garden_repository.dart' show initialSchedulesJson;

/// Хранит всё в памяти и повторяет серверные триггеры (пересчёт графика,
/// подстройку коэффициента). Используется в демо-режиме без Supabase и в тестах.
class DemoGardenRepository implements GardenRepository {
  DemoGardenRepository({
    DateTime Function()? clock,
    this.hemisphere = Hemisphere.north,
    List<Species>? species,
  })  : _clock = clock ?? DateTime.now,
        _species = species ?? demoSpecies;

  final DateTime Function() _clock;
  final Hemisphere hemisphere;
  final List<Species> _species;
  static const _uuid = Uuid();

  final _plants = <String, Plant>{};
  final _locations = <String, Location>{};
  final _schedules = <String, CareSchedule>{};
  final _events = <CareEvent>[];

  /// Пара растений, чтобы в демо-режиме экраны не были пустыми.
  Future<DemoGardenRepository> withSampleData() async {
    final now = _clock();
    final room = await addLocation('Гостиная', LightLevel.brightIndirect);
    final kitchen = await addLocation('Кухня', LightLevel.medium);
    await addPlant(NewPlant(
      nickname: 'Монстера Мося',
      speciesId: _bySlug('monstera-deliciosa')?.id,
      locationId: room.id,
      potMaterial: PotMaterial.plastic,
      lastWateredAt: now.subtract(const Duration(days: 9)),
    ));
    await addPlant(NewPlant(
      nickname: 'Щучка',
      speciesId: _bySlug('dracaena-trifasciata')?.id,
      locationId: kitchen.id,
      potMaterial: PotMaterial.ceramic,
      lastWateredAt: now.subtract(const Duration(days: 3)),
    ));
    return this;
  }

  Species? _bySlug(String slug) => _species.where((s) => s.slug == slug).firstOrNull;

  @override
  Future<List<Plant>> myPlants() async => _plants.values.map(_withDerived).toList();

  @override
  Future<PlantDetails> plantDetails(String plantId) async {
    final plant = _plants[plantId];
    if (plant == null) throw StateError('Растение не найдено');
    return PlantDetails(
      plant: _withDerived(plant),
      schedules: _schedules.values.where((s) => s.plantId == plantId).toList()
        ..sort((a, b) => a.type.index.compareTo(b.type.index)),
      events: _events.where((e) => e.plantId == plantId).toList()
        ..sort((a, b) => b.performedAt.compareTo(a.performedAt)),
    );
  }

  @override
  Future<Plant> addPlant(NewPlant draft) async {
    final id = _uuid.v4();
    final species = draft.speciesId == null ? null : await this.species(draft.speciesId!);
    _plants[id] = Plant(
      id: id,
      nickname: draft.nickname,
      speciesId: draft.speciesId,
      speciesName: species?.name,
      locationId: draft.locationId,
      potMaterial: draft.potMaterial,
      visibility: draft.visibility,
      notes: draft.notes,
    );
    for (final json in initialSchedulesJson(id, draft, species)) {
      final schedule = CareSchedule(
        id: json['id'] as String,
        plantId: id,
        type: CareType.fromDb(json['type'] as String),
        intervalDays: json['interval_days'] as double,
        lastDoneAt: json['last_done_at'] == null ? null : DateTime.parse(json['last_done_at'] as String).toLocal(),
      );
      _schedules[schedule.id] = _computeDue(schedule);
    }
    return _withDerived(_plants[id]!);
  }

  @override
  Future<void> deletePlant(String plantId) async {
    _plants.remove(plantId);
    _schedules.removeWhere((_, s) => s.plantId == plantId);
    _events.removeWhere((e) => e.plantId == plantId);
  }

  @override
  Future<List<Location>> myLocations() async => _locations.values.toList();

  @override
  Future<Location> addLocation(String name, LightLevel? light) async {
    final location = Location(id: _uuid.v4(), name: name, lightLevel: light);
    _locations[location.id] = location;
    return location;
  }

  @override
  Future<List<CareTask>> dueTasks(DateTime until) async {
    final tasks = [
      for (final s in _schedules.values)
        if (s.enabled && s.nextDueAt != null && !s.nextDueAt!.isAfter(until) && _plants.containsKey(s.plantId))
          CareTask(
            scheduleId: s.id,
            plantId: s.plantId,
            plantName: _plants[s.plantId]!.nickname,
            type: s.type,
            dueAt: s.nextDueAt!,
          ),
    ]..sort((a, b) => a.dueAt.compareTo(b.dueAt));
    return tasks;
  }

  /// Аналог триггера care_events_apply.
  @override
  Future<void> logCare(String plantId, CareType type, {DateTime? performedAt, String? note}) async {
    final at = performedAt ?? _clock();
    _events.add(CareEvent(id: _uuid.v4(), plantId: plantId, type: type, performedAt: at, note: note));

    final schedule = _schedules.values.where((s) => s.plantId == plantId && s.type == type).firstOrNull;
    if (schedule == null) return;
    final last = schedule.lastDoneAt;
    if (last != null && !at.isAfter(last)) return;

    var factor = schedule.userFactor;
    if (schedule.autoAdjust && last != null) {
      factor = CareIntervalCalculator.adjustUserFactor(
        current: factor,
        expectedDays: _intervalAt(schedule, last),
        actualDays: at.difference(last).inSeconds / Duration.secondsPerDay,
      );
    }
    _schedules[schedule.id] = _computeDue(schedule.copyWith(userFactor: factor, lastDoneAt: at));
  }

  @override
  Future<List<Species>> searchSpecies(String query) async =>
      query.trim().isEmpty ? _species : _species.where((s) => s.matches(query)).toList();

  @override
  Future<List<Species>> popularSpecies() async => _species;

  @override
  Future<Species?> species(String id) async => _species.where((s) => s.id == id).firstOrNull;

  /// Аналог триггера care_schedules_compute_due.
  CareSchedule _computeDue(CareSchedule s) {
    final base = s.lastDoneAt ?? _clock();
    return s.copyWith(nextDueAt: CareIntervalCalculator.nextDue(base, _intervalAt(s, base)));
  }

  double _intervalAt(CareSchedule s, DateTime at) {
    final plant = _plants[s.plantId];
    return CareIntervalCalculator.effectiveIntervalDays(
      type: s.type,
      intervalDays: s.intervalDays,
      userFactor: s.userFactor,
      autoAdjust: s.autoAdjust,
      month: at.month,
      hemisphere: hemisphere,
      pot: plant?.potMaterial,
      light: _locations[plant?.locationId]?.lightLevel,
    );
  }

  Plant _withDerived(Plant p) {
    final location = _locations[p.locationId];
    final water = _schedules.values.where((s) => s.plantId == p.id && s.type == CareType.water).firstOrNull;
    return Plant(
      id: p.id,
      nickname: p.nickname,
      speciesId: p.speciesId,
      speciesName: p.speciesName,
      locationId: p.locationId,
      locationName: location?.name,
      lightLevel: location?.lightLevel,
      potMaterial: p.potMaterial,
      visibility: p.visibility,
      notes: p.notes,
      nextWaterAt: water?.nextDueAt,
    );
  }
}
