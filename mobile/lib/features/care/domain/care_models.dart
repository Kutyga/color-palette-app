import '../../collection/domain/plant.dart';
import 'care_type.dart';

class CareSchedule {
  const CareSchedule({
    required this.id,
    required this.plantId,
    required this.type,
    required this.intervalDays,
    this.autoAdjust = true,
    this.userFactor = 1.0,
    this.lastDoneAt,
    this.nextDueAt,
    this.enabled = true,
  });

  final String id;
  final String plantId;
  final CareType type;
  final double intervalDays;
  final bool autoAdjust;
  final double userFactor;
  final DateTime? lastDoneAt;
  final DateTime? nextDueAt;
  final bool enabled;

  factory CareSchedule.fromJson(Map<String, dynamic> json) => CareSchedule(
        id: json['id'] as String,
        plantId: json['plant_id'] as String,
        type: CareType.fromDb(json['type'] as String),
        intervalDays: (json['interval_days'] as num).toDouble(),
        autoAdjust: json['auto_adjust'] as bool? ?? true,
        userFactor: (json['user_factor'] as num?)?.toDouble() ?? 1.0,
        lastDoneAt: _date(json['last_done_at']),
        nextDueAt: _date(json['next_due_at']),
        enabled: json['enabled'] as bool? ?? true,
      );

  CareSchedule copyWith({double? userFactor, DateTime? lastDoneAt, DateTime? nextDueAt}) =>
      CareSchedule(
        id: id,
        plantId: plantId,
        type: type,
        intervalDays: intervalDays,
        autoAdjust: autoAdjust,
        userFactor: userFactor ?? this.userFactor,
        lastDoneAt: lastDoneAt ?? this.lastDoneAt,
        nextDueAt: nextDueAt ?? this.nextDueAt,
        enabled: enabled,
      );
}

class CareEvent {
  const CareEvent({
    required this.id,
    required this.plantId,
    required this.type,
    required this.performedAt,
    this.note,
  });

  final String id;
  final String plantId;
  final CareType type;
  final DateTime performedAt;
  final String? note;

  factory CareEvent.fromJson(Map<String, dynamic> json) => CareEvent(
        id: json['id'] as String,
        plantId: json['plant_id'] as String,
        type: CareType.fromDb(json['type'] as String),
        performedAt: DateTime.parse(json['performed_at'] as String).toLocal(),
        note: json['note'] as String?,
      );
}

/// Задача на экране «Сегодня»: что и какому растению нужно сделать.
class CareTask {
  const CareTask({
    required this.scheduleId,
    required this.plantId,
    required this.plantName,
    required this.type,
    required this.dueAt,
  });

  final String scheduleId;
  final String plantId;
  final String plantName;
  final CareType type;
  final DateTime dueAt;

  bool isOverdue(DateTime now) => dueAt.isBefore(_startOfDay(now));
  bool isDueToday(DateTime now) => !isOverdue(now) && dueAt.isBefore(_startOfDay(now).add(const Duration(days: 1)));

  factory CareTask.fromJson(Map<String, dynamic> json) => CareTask(
        scheduleId: json['schedule_id'] as String,
        plantId: json['plant_id'] as String,
        plantName: json['nickname'] as String,
        type: CareType.fromDb(json['type'] as String),
        dueAt: DateTime.parse(json['next_due_at'] as String).toLocal(),
      );
}

/// Всё, что показывает карточка растения.
class PlantDetails {
  const PlantDetails({required this.plant, required this.schedules, required this.events});

  final Plant plant;
  final List<CareSchedule> schedules;
  final List<CareEvent> events;

  CareSchedule? scheduleFor(CareType type) {
    for (final s in schedules) {
      if (s.type == type) return s;
    }
    return null;
  }
}

DateTime _startOfDay(DateTime d) => DateTime(d.year, d.month, d.day);

DateTime? _date(Object? value) => value == null ? null : DateTime.parse(value as String).toLocal();
