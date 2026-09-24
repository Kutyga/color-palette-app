import 'care_type.dart';

/// Расчёт интервалов ухода. Повторяет SQL-функции из
/// supabase/migrations/20260924133411_care_logic.sql — менять синхронно.
///
/// Сервер — источник истины; клиент считает то же самое, чтобы напоминания
/// работали без сети.
abstract final class CareIntervalCalculator {
  static const double minIntervalDays = 0.5;

  /// Зима — период покоя (поливаем реже), лето — активный рост (чаще).
  static double seasonFactor(int month, Hemisphere hemisphere) {
    final m = hemisphere == Hemisphere.south ? (month + 5) % 12 + 1 : month;
    if (m == 12 || m == 1 || m == 2) return 1.4;
    if (m >= 6 && m <= 8) return 0.85;
    return 1.0;
  }

  static double potFactor(PotMaterial? material) => switch (material) {
        PotMaterial.terracotta => 0.85,
        PotMaterial.plastic || PotMaterial.glass => 1.1,
        _ => 1.0,
      };

  static double lightFactor(LightLevel? light) => switch (light) {
        LightLevel.low => 1.25,
        LightLevel.medium => 1.1,
        LightLevel.direct => 0.85,
        _ => 1.0,
      };

  static double effectiveIntervalDays({
    required CareType type,
    required double intervalDays,
    double userFactor = 1.0,
    bool autoAdjust = true,
    required int month,
    Hemisphere hemisphere = Hemisphere.north,
    PotMaterial? pot,
    LightLevel? light,
  }) {
    final adjustment = !autoAdjust
        ? 1.0
        : switch (type) {
            CareType.water => seasonFactor(month, hemisphere) * potFactor(pot) * lightFactor(light),
            CareType.mist => seasonFactor(month, hemisphere),
            _ => 1.0,
          };
    final days = _round(intervalDays * userFactor * adjustment, 1);
    return days < minIntervalDays ? minIntervalDays : days;
  }

  static DateTime nextDue(DateTime lastDone, double intervalDays) =>
      lastDone.add(Duration(seconds: (intervalDays * Duration.secondsPerDay).round()));

  /// Подстраивает коэффициент под привычки: если пользователь стабильно поливает
  /// раньше или позже графика, интервал плавно смещается. Сильные отклонения
  /// (забыли на две недели, полили дважды) не учитываются.
  static double adjustUserFactor({
    required double current,
    required double expectedDays,
    required double actualDays,
  }) {
    final ratio = actualDays / expectedDays;
    if (ratio < 0.5 || ratio > 1.5) return current;
    return _round(current * (0.8 + 0.2 * ratio), 2).clamp(0.3, 3.0);
  }

  /// Базовый интервал полива из базы знаний: летнее значение, приведённое к
  /// межсезонью (летний коэффициент 0.85), — зимой получится примерно зимнее.
  static double baseWaterInterval(double summerIntervalDays) => _round(summerIntervalDays / 0.85, 1);

  static double _round(double value, int digits) {
    final p = digits == 1 ? 10 : 100;
    // Поправка на двоичное представление (6.545 → 65.44999…), как у numeric в Postgres.
    return (value * p + 1e-9).round() / p;
  }
}
