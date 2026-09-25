import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker_platform_interface/image_picker_platform_interface.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:my_garden/app/app.dart';
import 'package:my_garden/app/providers.dart';
import 'package:my_garden/data/demo_garden_repository.dart';
import 'package:my_garden/data/demo_social_repository.dart';
import 'package:my_garden/data/demo_species.dart';
import 'package:my_garden/features/collection/presentation/add_plant_screen.dart';
import 'package:my_garden/features/identify/data/plant_identifier.dart';
import 'package:my_garden/features/identify/domain/identification.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show FunctionException;

import 'fakes.dart';

class FakeIdentifier implements PlantIdentifier {
  FakeIdentifier(this.result);

  final List<Prediction> result;
  int calls = 0;

  @override
  Future<List<Prediction>> identify(Uint8List jpeg) async {
    calls++;
    return result;
  }
}

class FailingIdentifier implements PlantIdentifier {
  FailingIdentifier(this.error);

  final Object error;

  @override
  Future<List<Prediction>> identify(Uint8List jpeg) async => throw error;
}

void main() {
  group('подготовка и разбор', () {
    test('метки: индекс совпадает с id, фон на месте 0', () {
      final labels = parseLabels('id,name\n0,background\n1,betula lenta\n3,monstera deliciosa\n');
      expect(labels, ['background', 'betula lenta', '', 'monstera deliciosa']);
    });

    test('фото обрезается по центру до квадрата 224×224 RGB', () {
      // Слева красный, справа синий: после обрезки по центру остаются обе половины.
      final rgb = preprocessRgb(jpeg(600, 300));
      expect(rgb.length, 224 * 224 * 3);
      final leftPixel = rgb.sublist(0, 3);
      final rightPixel = rgb.sublist((224 - 1) * 3, 224 * 3);
      expect(leftPixel[0], greaterThan(150));
      expect(rightPixel[2], greaterThan(150));
    });

    test('битое изображение — понятная ошибка', () {
      expect(() => preprocessRgb(Uint8List.fromList([1, 2, 3])), throwsFormatException);
    });

    test('лучшие варианты без фона и шума, по убыванию', () {
      final top = topPredictions([0.9, 0.01, 0.2, 0.6], ['background', 'a', 'b', 'c']);
      expect(top.map((p) => p.label), ['c', 'b']);
    });
  });

  group('сопоставление с базой знаний', () {
    test('точное название', () {
      final m = matchSpecies(const Prediction('monstera deliciosa', 0.8), demoSpecies);
      expect(m.species?.slug, 'monstera-deliciosa');
      expect(m.genusOnly, isFalse);
      expect(m.percent, 80);
    });

    test('синоним', () {
      expect(matchSpecies(const Prediction('Sansevieria trifasciata', 0.5), demoSpecies).species?.slug, 'dracaena-trifasciata');
    });

    test('только род', () {
      final m = matchSpecies(const Prediction('ficus benjamina', 0.4), demoSpecies);
      expect(m.species?.slug, 'ficus-elastica');
      expect(m.genusOnly, isTrue);
    });

    test('нет в базе', () {
      final m = matchSpecies(const Prediction('urtica dioica', 0.3, commonName: 'Крапива двудомная', source: IdentificationSource.plantNet), demoSpecies);
      expect(m.species, isNull);
      expect(m.commonName, 'Крапива двудомная');
      expect(m.source, IdentificationSource.plantNet);
      expect(capitalizeLatin(m.latinName), 'Urtica dioica');
    });
  });

  group('Pl@ntNet с запасным вариантом на телефоне', () {
    final onDevice = FakeIdentifier([const Prediction('aloe vera', 0.4)]);

    test('без сети — модель на телефоне', () async {
      final id = FallbackPlantIdentifier(FailingIdentifier(const SocketException('Failed host lookup')), onDevice);
      expect((await id.identify(Uint8List(1))).single.label, 'aloe vera');
    });

    test('квота исчерпана или сбой сервера — модель на телефоне', () async {
      for (final status in [429, 502, 503]) {
        final id = FallbackPlantIdentifier(FailingIdentifier(FunctionException(status: status)), onDevice);
        expect((await id.identify(Uint8List(1))).single.label, 'aloe vera', reason: 'HTTP $status');
      }
    });

    test('ошибка запроса (например, не вошёл) не маскируется', () async {
      final id = FallbackPlantIdentifier(FailingIdentifier(FunctionException(status: 401)), onDevice);
      await expectLater(id.identify(Uint8List(1)), throwsA(isA<FunctionException>()));
    });
  });

  testWidgets('фото → «Распознать» → вид подставлен из базы знаний', (tester) async {
    await initializeDateFormatting('ru');
    final picker = FakeImagePicker(jpeg(64, 64));
    ImagePickerPlatform.instance = picker;
    final identifier = FakeIdentifier(const [
      Prediction('Monstera deliciosa', 0.82, commonName: 'Монстера деликатесная', source: IdentificationSource.plantNet),
      Prediction('Urtica dioica', 0.1, commonName: 'Крапива двудомная', source: IdentificationSource.plantNet),
    ]);
    final garden = DemoGardenRepository();

    await tester.pumpWidget(ProviderScope(
      overrides: [
        gardenRepositoryProvider.overrideWithValue(garden),
        socialRepositoryProvider.overrideWithValue(DemoSocialRepository(garden: garden)),
        demoModeProvider.overrideWithValue(true),
        plantIdentifierProvider.overrideWithValue(identifier),
      ],
      child: const GardenApp(),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.bySemanticsLabel('Добавить растение'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Растение'));
    await tester.pumpAndSettle();

    expect(find.text('Распознать растение'), findsNothing, reason: 'без фото кнопки нет');
    await tester.tap(find.text('Сфотографировать'));
    await tester.pumpAndSettle();
    expect(picker.sources, [ImageSource.camera], reason: 'только камера, без галереи');

    await tester.tap(find.text('Распознать растение'));
    await tester.pumpAndSettle();
    expect(identifier.calls, 1);
    expect(find.text('Похоже на'), findsOneWidget);
    expect(find.text('82%'), findsOneWidget);
    expect(find.text('По данным Pl@ntNet. Проверьте по фото в базе знаний.'), findsOneWidget);
    expect(find.text('Крапива двудомная'), findsOneWidget);
    expect(find.text('Urtica dioica · нет в базе знаний — добавим с этим названием'), findsOneWidget);

    await tester.tap(find.text('Монстера деликатесная'));
    await tester.pumpAndSettle();

    final screen = find.byType(AddPlantScreen);
    expect(find.descendant(of: screen, matching: find.text('Монстера деликатесная')), findsWidgets);
    expect(find.descendant(of: screen, matching: find.text('Monstera deliciosa')), findsOneWidget);
    expect(tester.widget<TextField>(find.descendant(of: screen, matching: find.byType(TextField))).controller!.text, 'Монстера деликатесная');
  });
}
