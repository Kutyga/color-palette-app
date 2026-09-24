import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:uuid/uuid.dart';

import '../core/offline/local_store.dart';
import '../core/offline/network_errors.dart';
import '../features/care/domain/care_interval_calculator.dart';
import '../features/care/domain/care_models.dart';
import '../features/care/domain/care_type.dart';
import '../features/collection/domain/plant.dart';
import '../features/gamification/domain/gamification.dart';
import '../features/knowledge_base/domain/species.dart';
import 'garden_repository.dart';

/// Состояние связи и очереди изменений — для плашки «нет сети».
class SyncState {
  const SyncState({this.offline = false, this.pending = 0, this.syncing = false});

  final bool offline;
  final int pending;
  final bool syncing;

  bool get isIdle => !offline && pending == 0;
}

/// Офлайн-слой над серверным репозиторием:
/// • чтение — с сервера, копия сохраняется на устройстве; без сети отдаётся копия;
/// • отметки ухода — без сети встают в очередь, график пересчитывается локально
///   той же формулой, что и на сервере; очередь уходит при появлении сети;
/// • у каждой отметки клиентский id, поэтому повторная отправка не создаёт дубль.
/// Добавление растений, мест и фото требует сети.
class OfflineGardenRepository implements GardenRepository {
  OfflineGardenRepository(
    this._remote,
    this._store, {
    DateTime Function()? clock,
    this.hemisphere = Hemisphere.north,
    this.timeout = const Duration(seconds: 12),
  }) : _clock = clock ?? DateTime.now {
    _state = SyncState(pending: _outbox().length);
  }

  final GardenRepository _remote;
  final LocalStore _store;
  final DateTime Function() _clock;
  final Hemisphere hemisphere;
  final Duration timeout;
  static const _uuid = Uuid();

  static const _kPlants = 'cache.plants';
  static const _kLocations = 'cache.locations';
  static const _kTasks = 'cache.tasks';
  static const _kStats = 'cache.stats';
  static const _kSpecies = 'cache.species';
  static const _kOutbox = 'outbox.care_events';
  static String _kDetails(String plantId) => 'cache.details.$plantId';

  late SyncState _state;
  final _states = StreamController<SyncState>.broadcast();
  Future<void>? _syncing;
  Timer? _timer;

  SyncState get state => _state;
  Stream<SyncState> get states => _states.stream;

  void _emit(SyncState s) {
    _state = s;
    _states.add(s);
  }

  /// Периодически пробует отправить очередь (приложение вызывает при старте).
  void startAutoSync([Duration every = const Duration(minutes: 1)]) {
    _timer ??= Timer.periodic(every, (_) {
      if (_state.pending > 0) sync();
    });
  }

  void dispose() {
    _timer?.cancel();
    _states.close();
  }

  // ---------------------------------------------------------------------------
  // Связь
  // ---------------------------------------------------------------------------

  Future<T> _online<T>(Future<T> Function() call) async {
    try {
      final result = await call().timeout(timeout);
      if (_state.offline) _emit(SyncState(pending: _state.pending));
      return result;
    } catch (e) {
      if (isNetworkError(e) && !_state.offline) _emit(SyncState(offline: true, pending: _state.pending));
      rethrow;
    }
  }

  /// Сначала досылаем очередь, чтобы ответ сервера уже учитывал офлайн-отметки.
  Future<T> _read<T>(Future<T> Function() remote, T? Function() cached, Future<void> Function(T) save) async {
    if (_state.pending > 0) {
      await sync();
      // Очередь не ушла из-за сети — не ждём второго таймаута, сразу показываем копию.
      if (_state.offline && _state.pending > 0) {
        final copy = cached();
        if (copy != null) return copy;
      }
    }
    try {
      final value = await _online(remote);
      await save(value);
      return value;
    } catch (e) {
      if (!isNetworkError(e)) rethrow;
      final copy = cached();
      if (copy == null) rethrow;
      return copy;
    }
  }

  // ---------------------------------------------------------------------------
  // Очередь
  // ---------------------------------------------------------------------------

  List<Map<String, dynamic>> _outbox() => _decodeList(_store.read(_kOutbox));

  Future<void> _saveOutbox(List<Map<String, dynamic>> items) async {
    await _store.write(_kOutbox, jsonEncode(items));
    _emit(SyncState(offline: _state.offline, pending: items.length, syncing: _state.syncing));
  }

  /// Отправляет очередь по порядку. Ошибка связи — остановка до следующей попытки;
  /// другая ошибка (например, растение удалили) — запись выбрасывается, иначе очередь встанет.
  Future<void> sync() => _syncing ??= _flush().whenComplete(() => _syncing = null);

  Future<void> _flush() async {
    var queue = _outbox();
    if (queue.isEmpty) return;
    _emit(SyncState(offline: _state.offline, pending: queue.length, syncing: true));
    try {
      while (queue.isNotEmpty) {
        final item = queue.first;
        try {
          await _online(() => _remote.logCare(
                item['plant_id'] as String,
                CareType.fromDb(item['type'] as String),
                id: item['id'] as String,
                performedAt: DateTime.parse(item['performed_at'] as String),
                note: item['note'] as String?,
              ));
        } catch (e) {
          if (isNetworkError(e)) break;
        }
        queue = queue.sublist(1);
        await _saveOutbox(queue);
      }
    } finally {
      _emit(SyncState(offline: _state.offline, pending: queue.length));
    }
  }

  // ---------------------------------------------------------------------------
  // Чтение
  // ---------------------------------------------------------------------------

  @override
  Future<List<Plant>> myPlants() => _read(
        _remote.myPlants,
        () => _cachedList(_kPlants, Plant.fromCache),
        (v) => _store.write(_kPlants, jsonEncode([for (final p in v) p.toJson()])),
      );

  @override
  Future<PlantDetails> plantDetails(String plantId) => _read(
        () => _remote.plantDetails(plantId),
        () => _cachedDetails(plantId),
        (v) => _store.write(_kDetails(plantId), jsonEncode(v.toJson())),
      );

  @override
  Future<List<Location>> myLocations() => _read(
        _remote.myLocations,
        () => _cachedList(_kLocations, Location.fromJson),
        (v) => _store.write(_kLocations, jsonEncode([for (final l in v) l.toJson()])),
      );

  @override
  Future<List<CareTask>> dueTasks(DateTime until) async {
    final tasks = await _read(
      () => _remote.dueTasks(until),
      () => _cachedList(_kTasks, CareTask.fromJson),
      (v) => _store.write(_kTasks, jsonEncode([for (final t in v) t.toJson()])),
    );
    return tasks.where((t) => !t.dueAt.isAfter(until)).toList()..sort((a, b) => a.dueAt.compareTo(b.dueAt));
  }

  @override
  Future<GardenStats> stats() => _read(
        _remote.stats,
        () => _store.read(_kStats) == null ? null : GardenStats.fromJson(jsonDecode(_store.read(_kStats)!) as Map<String, dynamic>),
        (v) => _store.write(_kStats, jsonEncode(v.toJson())),
      );

  @override
  Future<List<Species>> popularSpecies() => _read(
        _remote.popularSpecies,
        () => _cachedSpecies().values.toList(),
        _rememberSpecies,
      );

  @override
  Future<List<Species>> searchSpecies(String query) => _read(
        () => _remote.searchSpecies(query),
        () => [for (final s in _cachedSpecies().values) if (query.trim().isEmpty || s.matches(query)) s],
        _rememberSpecies,
      );

  @override
  Future<Species?> species(String id) => _read(
        () => _remote.species(id),
        () => _cachedSpecies()[id],
        (s) async {
          if (s != null) await _rememberSpecies([s]);
        },
      );

  // ---------------------------------------------------------------------------
  // Запись
  // ---------------------------------------------------------------------------

  @override
  Future<void> logCare(String plantId, CareType type, {String? id, DateTime? performedAt, String? note}) async {
    final eventId = id ?? _uuid.v4();
    final at = performedAt ?? _clock();
    try {
      await _online(() => _remote.logCare(plantId, type, id: eventId, performedAt: at, note: note));
    } catch (e) {
      if (!isNetworkError(e)) rethrow;
      await _saveOutbox([
        ..._outbox(),
        {'id': eventId, 'plant_id': plantId, 'type': type.dbName, 'performed_at': at.toUtc().toIso8601String(), 'note': note},
      ]);
      await _applyLocally(plantId, type, eventId, at, note);
    }
  }

  @override
  Future<Plant> addPlant(NewPlant draft) => _online(() => _remote.addPlant(draft));

  @override
  Future<void> deletePlant(String plantId) => _online(() => _remote.deletePlant(plantId));

  @override
  Future<void> setPlantPhoto(String plantId, Uint8List jpeg) => _online(() => _remote.setPlantPhoto(plantId, jpeg));

  @override
  Future<Location> addLocation(String name, LightLevel? light) => _online(() => _remote.addLocation(name, light));

  // ---------------------------------------------------------------------------
  // Локальный пересчёт — повторяет триггер care_events_apply
  // ---------------------------------------------------------------------------

  Future<void> _applyLocally(String plantId, CareType type, String eventId, DateTime at, String? note) async {
    final details = _cachedDetails(plantId);
    DateTime? nextDue;
    if (details != null) {
      final schedule = details.scheduleFor(type);
      var schedules = details.schedules;
      if (schedule != null && (schedule.lastDoneAt == null || at.isAfter(schedule.lastDoneAt!))) {
        double interval(CareSchedule s, DateTime when) => CareIntervalCalculator.effectiveIntervalDays(
              type: s.type,
              intervalDays: s.intervalDays,
              userFactor: s.userFactor,
              autoAdjust: s.autoAdjust,
              month: when.month,
              hemisphere: hemisphere,
              pot: details.plant.potMaterial,
              light: details.plant.lightLevel,
            );
        var factor = schedule.userFactor;
        final last = schedule.lastDoneAt;
        if (schedule.autoAdjust && last != null) {
          factor = CareIntervalCalculator.adjustUserFactor(
            current: factor,
            expectedDays: interval(schedule, last),
            actualDays: at.difference(last).inSeconds / Duration.secondsPerDay,
          );
        }
        final updated = schedule.copyWith(userFactor: factor, lastDoneAt: at);
        nextDue = CareIntervalCalculator.nextDue(at, interval(updated, at));
        schedules = [for (final s in schedules) s.id == schedule.id ? updated.copyWith(nextDueAt: nextDue) : s];
      }
      final updatedDetails = PlantDetails(
        plant: details.plant,
        schedules: schedules,
        events: [CareEvent(id: eventId, plantId: plantId, type: type, performedAt: at, note: note), ...details.events],
      );
      await _store.write(_kDetails(plantId), jsonEncode(updatedDetails.toJson()));
    }

    // «Сегодня»: задача сдвигается на новый срок, а без данных о графике просто уходит из списка.
    final tasks = _cachedList(_kTasks, CareTask.fromJson);
    if (tasks != null) {
      final updated = [
        for (final t in tasks)
          if (t.plantId != plantId || t.type != type)
            t
          else if (nextDue != null)
            CareTask(scheduleId: t.scheduleId, plantId: t.plantId, plantName: t.plantName, type: t.type, dueAt: nextDue),
      ];
      await _store.write(_kTasks, jsonEncode([for (final t in updated) t.toJson()]));
    }

    if (type == CareType.water && nextDue != null) {
      final plants = _cachedList(_kPlants, Plant.fromCache);
      if (plants != null) {
        final updated = [
          for (final p in plants)
            p.id == plantId ? Plant.fromCache({...p.toJson(), 'care_schedules': [{'type': 'water', 'next_due_at': nextDue.toUtc().toIso8601String()}]}) : p,
        ];
        await _store.write(_kPlants, jsonEncode([for (final p in updated) p.toJson()]));
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Кэш
  // ---------------------------------------------------------------------------

  List<T>? _cachedList<T>(String key, T Function(Map<String, dynamic>) decode) {
    final raw = _store.read(key);
    return raw == null ? null : [for (final j in _decodeList(raw)) decode(j)];
  }

  PlantDetails? _cachedDetails(String plantId) {
    final raw = _store.read(_kDetails(plantId));
    return raw == null ? null : PlantDetails.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  Map<String, Species> _cachedSpecies() {
    final raw = _store.read(_kSpecies);
    if (raw == null) return {};
    final map = jsonDecode(raw) as Map<String, dynamic>;
    return {for (final e in map.entries) e.key: Species.fromJson(e.value as Map<String, dynamic>)};
  }

  Future<void> _rememberSpecies(List<Species> list) async {
    final all = {..._cachedSpecies(), for (final s in list) s.id: s};
    await _store.write(_kSpecies, jsonEncode({for (final e in all.entries) e.key: e.value.toJson()}));
  }

  static List<Map<String, dynamic>> _decodeList(String? raw) =>
      raw == null ? [] : (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
}
