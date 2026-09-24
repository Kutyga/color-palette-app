import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';

import '../features/care/domain/care_interval_calculator.dart';
import '../features/care/domain/care_models.dart';
import '../features/care/domain/care_type.dart';
import '../features/collection/domain/plant.dart';
import '../features/gamification/domain/gamification.dart';
import '../features/knowledge_base/domain/species.dart';
import 'garden_repository.dart';

/// Работа с Supabase. Доступ ограничивают RLS-политики на сервере,
/// пересчёт графиков делают триггеры (см. supabase/migrations).
class SupabaseGardenRepository implements GardenRepository {
  SupabaseGardenRepository(this._db);

  final SupabaseClient _db;
  static const _uuid = Uuid();

  static const _plantSelect =
      '*, species(latin_name, common_names), locations(name, light_level), care_schedules(type, next_due_at)';

  String get _uid => _db.auth.currentUser!.id;

  @override
  Future<List<Plant>> myPlants() async {
    final rows = await _db
        .from('plants')
        .select(_plantSelect)
        .eq('owner_id', _uid)
        .isFilter('deleted_at', null)
        .order('created_at');
    return rows.map(Plant.fromJson).toList();
  }

  @override
  Future<PlantDetails> plantDetails(String plantId) async {
    final results = await Future.wait([
      _db.from('plants').select(_plantSelect).eq('id', plantId).single(),
      _db.from('care_schedules').select().eq('plant_id', plantId).order('type'),
      _db
          .from('care_events')
          .select()
          .eq('plant_id', plantId)
          .order('performed_at', ascending: false)
          .limit(50),
    ]);
    return PlantDetails(
      plant: Plant.fromJson(results[0] as Map<String, dynamic>),
      schedules: (results[1] as List).cast<Map<String, dynamic>>().map(CareSchedule.fromJson).toList(),
      events: (results[2] as List).cast<Map<String, dynamic>>().map(CareEvent.fromJson).toList(),
    );
  }

  @override
  Future<Plant> addPlant(NewPlant draft) async {
    final plantId = _uuid.v4();
    final species = draft.speciesId == null ? null : await this.species(draft.speciesId!);
    await _db.from('plants').insert({
      'id': plantId,
      'nickname': draft.nickname,
      'species_id': draft.speciesId,
      'location_id': draft.locationId,
      'pot_material': draft.potMaterial?.dbName,
      'visibility': draft.visibility.dbName,
      'notes': draft.notes,
    });
    await _db.from('care_schedules').insert(initialSchedulesJson(plantId, draft, species));
    return (await plantDetails(plantId)).plant;
  }

  @override
  Future<void> deletePlant(String plantId) =>
      _db.from('plants').update({'deleted_at': DateTime.now().toUtc().toIso8601String()}).eq('id', plantId);

  @override
  Future<List<Location>> myLocations() async {
    final rows = await _db
        .from('locations')
        .select()
        .eq('owner_id', _uid)
        .isFilter('deleted_at', null)
        .order('name');
    return rows.map(Location.fromJson).toList();
  }

  @override
  Future<Location> addLocation(String name, LightLevel? light) async {
    final row = await _db
        .from('locations')
        .insert({'id': _uuid.v4(), 'name': name, 'light_level': light?.dbName})
        .select()
        .single();
    return Location.fromJson(row);
  }

  @override
  Future<List<CareTask>> dueTasks(DateTime until) async {
    final rows = await _db.rpc<List<dynamic>>('care_due', params: {'p_until': until.toUtc().toIso8601String()});
    return rows.cast<Map<String, dynamic>>().map(CareTask.fromJson).toList();
  }

  @override
  Future<void> logCare(String plantId, CareType type, {DateTime? performedAt, String? note}) =>
      _db.from('care_events').insert({
        'id': _uuid.v4(),
        'plant_id': plantId,
        'type': type.dbName,
        'performed_at': (performedAt ?? DateTime.now()).toUtc().toIso8601String(),
        'note': note,
      });

  @override
  Future<List<Species>> searchSpecies(String query) async {
    if (query.trim().isEmpty) return popularSpecies();
    final rows = await _db.rpc<List<dynamic>>('search_species', params: {'q': query.trim(), 'lim': 30});
    return rows.cast<Map<String, dynamic>>().map(Species.fromJson).toList();
  }

  @override
  Future<List<Species>> popularSpecies() async {
    final rows = await _db.from('species').select('*, care_profiles(*)').order('latin_name').limit(50);
    return rows.map(Species.fromJson).toList();
  }

  @override
  Future<GardenStats> stats() async =>
      GardenStats.fromJson(await _db.rpc<Map<String, dynamic>>('my_garden_stats'));

  @override
  Future<Species?> species(String id) async {
    final row = await _db.from('species').select('*, care_profiles(*)').eq('id', id).maybeSingle();
    return row == null ? null : Species.fromJson(row);
  }
}

/// Графики ухода для нового растения по данным базы знаний.
/// Общая логика для Supabase и демо-репозитория.
List<Map<String, dynamic>> initialSchedulesJson(String plantId, NewPlant draft, Species? species) {
  const uuid = Uuid();
  final care = species?.care;
  final water = draft.waterIntervalDays ??
      (care == null ? 7.0 : CareIntervalCalculator.baseWaterInterval(care.waterIntervalSummer));
  return [
    {
      'id': uuid.v4(),
      'plant_id': plantId,
      'type': CareType.water.dbName,
      'interval_days': water,
      'last_done_at': draft.lastWateredAt?.toUtc().toIso8601String(),
    },
    if (care?.fertilizeIntervalDays != null)
      {
        'id': uuid.v4(),
        'plant_id': plantId,
        'type': CareType.fertilize.dbName,
        'interval_days': care!.fertilizeIntervalDays!.toDouble(),
        'last_done_at': null,
      },
    if (care?.repotEveryYears != null)
      {
        'id': uuid.v4(),
        'plant_id': plantId,
        'type': CareType.repot.dbName,
        'interval_days': care!.repotEveryYears! * 365.0,
        'last_done_at': null,
      },
  ];
}

