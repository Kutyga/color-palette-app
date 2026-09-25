import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:timezone/data/latest.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;

import '../../features/care/domain/care_models.dart';
import '../../features/care/domain/care_type.dart';

/// Одно уведомление на день: «Сегодня полить: Мося, Щучка».
class DailyReminder {
  const DailyReminder({required this.at, required this.title, required this.body});

  final DateTime at;
  final String title;
  final String body;
}

/// Группирует задачи по дням и назначает время напоминания.
/// Просроченные задачи попадают в ближайшее напоминание.
List<DailyReminder> buildDailyReminders(
  List<CareTask> tasks,
  DateTime now, {
  TimeOfDay time = const TimeOfDay(hour: 9, minute: 0),
  int days = 7,
}) {
  final today = DateTime(now.year, now.month, now.day);
  var pending = [...tasks];
  final reminders = <DailyReminder>[];
  for (var i = 0; i < days && pending.isNotEmpty; i++) {
    final day = today.add(Duration(days: i));
    final dayEnd = day.add(const Duration(days: 1));
    final dayTasks = pending.where((t) => t.dueAt.isBefore(dayEnd)).toList();
    if (dayTasks.isEmpty) continue;
    pending = pending.where((t) => !t.dueAt.isBefore(dayEnd)).toList();

    var at = DateTime(day.year, day.month, day.day, time.hour, time.minute);
    // Сегодняшнее время напоминания уже прошло — напомним через минуту.
    if (!at.isAfter(now)) at = now.add(const Duration(minutes: 1));
    reminders.add(DailyReminder(at: at, title: _title(dayTasks), body: _body(dayTasks)));
  }
  return reminders;
}

String _title(Iterable<CareTask> tasks) {
  final types = tasks.map((t) => t.type).toSet();
  final plants = tasks.map((t) => t.plantId).toSet().length;
  if (types.length == 1) {
    return '${types.first.action}: ${_plantsWord(plants)}';
  }
  return 'Уход за растениями: ${_plantsWord(plants)}';
}

String _body(Iterable<CareTask> tasks) {
  final byType = <CareType, List<String>>{};
  for (final t in tasks) {
    byType.putIfAbsent(t.type, () => []).add(t.plantName);
  }
  return byType.entries.map((e) => '${e.key.label}: ${e.value.join(', ')}').join('\n');
}

String _plantsWord(int n) {
  final mod10 = n % 10, mod100 = n % 100;
  final word = mod10 == 1 && mod100 != 11
      ? 'растение'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
          ? 'растения'
          : 'растений';
  return '$n $word';
}

abstract interface class ReminderService {
  Future<void> init();
  Future<void> reschedule(List<CareTask> tasks);
}

class NoopReminderService implements ReminderService {
  const NoopReminderService();

  @override
  Future<void> init() async {}

  @override
  Future<void> reschedule(List<CareTask> tasks) async {}
}

/// Локальные уведомления: работают без сети, пересоздаются при каждом
/// изменении списка задач.
class LocalReminderService implements ReminderService {
  LocalReminderService({this.time = const TimeOfDay(hour: 9, minute: 0)});

  final TimeOfDay time;
  final _plugin = FlutterLocalNotificationsPlugin();
  bool _ready = false;

  static const _details = NotificationDetails(
    android: AndroidNotificationDetails(
      'care_reminders',
      'Напоминания об уходе',
      channelDescription: 'Полив, подкормка и другой уход за растениями',
      importance: Importance.high,
      priority: Priority.high,
    ),
    iOS: DarwinNotificationDetails(),
  );

  @override
  Future<void> init() async {
    tz_data.initializeTimeZones();
    try {
      final local = await FlutterTimezone.getLocalTimezone();
      tz.setLocalLocation(tz.getLocation(local.identifier));
    } catch (_) {
      // Остаёмся на UTC — время напоминания может сместиться, но они придут.
    }
    await _plugin.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
    );
    await _plugin
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.requestNotificationsPermission();
    _ready = true;
  }

  @override
  Future<void> reschedule(List<CareTask> tasks) async {
    if (!_ready) return;
    await _plugin.cancelAll();
    final reminders = buildDailyReminders(tasks, DateTime.now(), time: time);
    for (final (i, r) in reminders.indexed) {
      await _plugin.zonedSchedule(
        id: i,
        scheduledDate: tz.TZDateTime.from(r.at, tz.local),
        notificationDetails: _details,
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
        title: r.title,
        body: r.body,
        payload: '/today',
      );
    }
  }
}
