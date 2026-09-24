import 'package:flutter_test/flutter_test.dart';
import 'package:my_garden/features/care/domain/care_interval_calculator.dart';
import 'package:my_garden/features/care/domain/care_type.dart';

/// Ожидаемые значения совпадают с supabase/tests/smoke_test.sql —
/// клиентская и серверная формулы должны давать одно и то же.
void main() {
  group('effectiveIntervalDays', () {
    test('лето, пластик, яркий рассеянный: 7 × 0.85 × 1.1 = 6.5', () {
      expect(
        CareIntervalCalculator.effectiveIntervalDays(
          type: CareType.water,
          intervalDays: 7,
          month: 7,
          pot: PotMaterial.plastic,
          light: LightLevel.brightIndirect,
        ),
        6.5,
      );
    });

    test('коэффициент пользователя 0.98: 6.4 дня', () {
      expect(
        CareIntervalCalculator.effectiveIntervalDays(
          type: CareType.water,
          intervalDays: 7,
          userFactor: 0.98,
          month: 7,
          pot: PotMaterial.plastic,
          light: LightLevel.brightIndirect,
        ),
        6.4,
      );
    });

    test('терракота: 7 × 0.98 × 0.85 × 0.85 = 5.0', () {
      expect(
        CareIntervalCalculator.effectiveIntervalDays(
          type: CareType.water,
          intervalDays: 7,
          userFactor: 0.98,
          month: 7,
          pot: PotMaterial.terracotta,
          light: LightLevel.brightIndirect,
        ),
        5.0,
      );
    });

    test('июль в южном полушарии — зима: 8.2', () {
      expect(
        CareIntervalCalculator.effectiveIntervalDays(
          type: CareType.water,
          intervalDays: 7,
          userFactor: 0.98,
          month: 7,
          hemisphere: Hemisphere.south,
          pot: PotMaterial.terracotta,
          light: LightLevel.brightIndirect,
        ),
        8.2,
      );
    });

    test('без автоподстройки интервал не меняется', () {
      expect(
        CareIntervalCalculator.effectiveIntervalDays(
          type: CareType.water,
          intervalDays: 7,
          autoAdjust: false,
          month: 1,
          pot: PotMaterial.terracotta,
          light: LightLevel.low,
        ),
        7,
      );
    });

    test('сезон не влияет на пересадку', () {
      expect(
        CareIntervalCalculator.effectiveIntervalDays(type: CareType.repot, intervalDays: 365, month: 1, light: LightLevel.low),
        365,
      );
    });

    test('интервал не бывает меньше полудня', () {
      expect(
        CareIntervalCalculator.effectiveIntervalDays(type: CareType.water, intervalDays: 0.3, month: 7, light: LightLevel.direct),
        0.5,
      );
    });
  });

  group('adjustUserFactor', () {
    test('полил на полдня раньше — коэффициент 0.98', () {
      expect(CareIntervalCalculator.adjustUserFactor(current: 1, expectedDays: 6.5, actualDays: 6), 0.98);
    });

    test('сильное отклонение игнорируется', () {
      expect(CareIntervalCalculator.adjustUserFactor(current: 1, expectedDays: 7, actualDays: 20), 1);
      expect(CareIntervalCalculator.adjustUserFactor(current: 1, expectedDays: 7, actualDays: 1), 1);
    });

    test('коэффициент ограничен снизу', () {
      expect(CareIntervalCalculator.adjustUserFactor(current: 0.3, expectedDays: 10, actualDays: 5), 0.3);
    });
  });

  test('nextDue добавляет дробные дни', () {
    expect(
      CareIntervalCalculator.nextDue(DateTime.utc(2026, 7, 7), 6.4),
      DateTime.utc(2026, 7, 13, 9, 36),
    );
  });

  test('базовый интервал из летнего значения базы знаний', () {
    expect(CareIntervalCalculator.baseWaterInterval(7), 8.2);
  });
}
