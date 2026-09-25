import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker_platform_interface/image_picker_platform_interface.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:my_garden/app/app.dart';
import 'package:my_garden/app/providers.dart';
import 'package:my_garden/data/demo_garden_repository.dart';
import 'package:my_garden/data/demo_social_repository.dart';
import 'package:my_garden/features/collection/domain/plant.dart';
import 'package:my_garden/features/collection/presentation/add_plant_screen.dart';
import 'package:my_garden/features/collection/presentation/plant_screen.dart';

import 'fakes.dart';

void main() {
  setUpAll(() => initializeDateFormatting('ru'));

  Future<DemoGardenRepository> pumpApp(WidgetTester tester, {bool withPlant = true}) async {
    final repo = DemoGardenRepository();
    if (withPlant) {
      await repo.addPlant(NewPlant(
        nickname: 'Монстера Мося',
        waterIntervalDays: 7,
        lastWateredAt: DateTime.now().subtract(const Duration(days: 20)),
      ));
    }
    await tester.pumpWidget(ProviderScope(
      overrides: [
        gardenRepositoryProvider.overrideWithValue(repo),
        socialRepositoryProvider.overrideWithValue(DemoSocialRepository(garden: repo)),
        demoModeProvider.overrideWithValue(true),
      ],
      child: const GardenApp(),
    ));
    await tester.pumpAndSettle();
    return repo;
  }

  testWidgets('просроченный полив можно отметить с экрана «Сегодня»', (tester) async {
    final repo = await pumpApp(tester);

    expect(find.text('Сегодня'), findsWidgets);
    expect(find.text('Ждут заботы'), findsOneWidget);
    expect(find.text('0 из 1 сделано'), findsOneWidget);

    await tester.tap(find.byTooltip('Полить'));
    await tester.pumpAndSettle();

    expect(find.text('1 из 1 сделано'), findsOneWidget);
    expect(find.text('Ждут заботы'), findsNothing);
    final plant = (await repo.myPlants()).single;
    expect((await repo.plantDetails(plant.id)).events, hasLength(1));
  });

  testWidgets('пустая коллекция предлагает добавить растение', (tester) async {
    await pumpApp(tester, withPlant: false);
    await tester.tap(find.text('Коллекция'));
    await tester.pumpAndSettle();
    expect(find.text('Здесь будет ваш сад'), findsOneWidget);
  });

  testWidgets('добавление растения из базы знаний', (tester) async {
    ImagePickerPlatform.instance = FakeImagePicker(jpeg(64, 64));
    final repo = await pumpApp(tester, withPlant: false);
    await tester.tap(find.bySemanticsLabel('Добавить растение'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Растение'));
    await tester.pumpAndSettle();

    // Без снимка растение не добавить.
    await tester.tap(find.text('Сфотографировать'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Выбрать из базы знаний'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).last, 'хлоро');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Хлорофитум хохлатый'));
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Добавить в коллекцию'),
      200,
      scrollable: find.descendant(of: find.byType(AddPlantScreen), matching: find.byType(Scrollable)).first,
    );
    await tester.tap(find.text('Добавить в коллекцию'));
    await tester.pumpAndSettle();

    final plants = await repo.myPlants();
    expect(plants.single.nickname, 'Хлорофитум хохлатый');
    // Открылась карточка нового растения.
    expect(find.byType(PlantScreen), findsOneWidget);
    expect(find.text('Полить', skipOffstage: false), findsOneWidget);
  });
}
