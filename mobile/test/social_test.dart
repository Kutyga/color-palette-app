import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:my_garden/app/app.dart';
import 'package:my_garden/app/providers.dart';
import 'package:my_garden/data/demo_garden_repository.dart';
import 'package:my_garden/data/demo_social_repository.dart';
import 'package:my_garden/features/collection/domain/plant.dart';
import 'package:my_garden/features/social/create_post_screen.dart';
import 'package:my_garden/features/social/domain/social.dart';

void main() {
  setUpAll(() => initializeDateFormatting('ru'));

  group('DemoSocialRepository', () {
    test('свой пост попадает в «Подписки» первым и привязан к растению', () async {
      final garden = DemoGardenRepository();
      final plant = await garden.addPlant(const NewPlant(nickname: 'Мося', speciesId: 'demo-monstera'));
      final social = DemoSocialRepository(garden: garden);

      await social.createPost(NewPost(text: 'Новый лист!', plantId: plant.id));
      final feed = await social.feed(FeedTab.following);
      expect(feed.first.text, 'Новый лист!');
      expect(feed.first.plantName, 'Мося');
      expect((await social.myActivity()).posts, 1);
    });

    test('лайк и отмена лайка меняют счётчик один раз', () async {
      final social = DemoSocialRepository(garden: DemoGardenRepository());
      final post = (await social.feed(FeedTab.discover)).first;
      await social.setLiked(post.id, true);
      await social.setLiked(post.id, true);
      var updated = (await social.feed(FeedTab.discover)).firstWhere((p) => p.id == post.id);
      expect(updated.likeCount, post.likeCount + 1);
      expect(updated.likedByMe, isTrue);
      await social.setLiked(post.id, false);
      updated = (await social.feed(FeedTab.discover)).firstWhere((p) => p.id == post.id);
      expect(updated.likeCount, post.likeCount);
    });

    test('новости «про мои растения» фильтруются по видам коллекции', () async {
      final garden = DemoGardenRepository();
      final social = DemoSocialRepository(garden: garden);
      expect(await social.news(onlyMySpecies: true), isEmpty);
      await garden.addPlant(const NewPlant(nickname: 'Мося', speciesId: 'demo-monstera'));
      final mine = await social.news(onlyMySpecies: true);
      expect(mine.single.title, contains('Монстера'));
      expect(await social.news(), hasLength(4));
    });
  });

  Future<void> pumpApp(WidgetTester tester) async {
    final garden = DemoGardenRepository();
    await tester.pumpWidget(ProviderScope(
      overrides: [
        gardenRepositoryProvider.overrideWithValue(garden),
        socialRepositoryProvider.overrideWithValue(DemoSocialRepository(garden: garden)),
        demoModeProvider.overrideWithValue(true),
      ],
      child: const GardenApp(),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Лента'));
    await tester.pumpAndSettle();
  }

  testWidgets('вкладка «Новости» показывает подборку', (tester) async {
    await pumpApp(tester);
    await tester.tap(find.text('Новости'));
    await tester.pumpAndSettle();
    expect(find.text('Осень на подоконнике: как перевести растения на зимний режим'), findsOneWidget);
    expect(find.text('Про мои растения'), findsOneWidget);
  });

  testWidgets('текстовый пост публикуется и даёт достижение', (tester) async {
    await pumpApp(tester);
    await tester.tap(find.byTooltip('Новый пост'));
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.byType(TextField),
      300,
      scrollable: find.descendant(of: find.byType(CreatePostScreen), matching: find.byType(Scrollable)).first,
    );
    await tester.enterText(find.byType(TextField), 'Мой первый пост');
    await tester.pump();
    await tester.tap(find.text('Опубликовать'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Звезда подоконника'), findsOneWidget);
    await tester.tap(find.text('Подписки'));
    await tester.pumpAndSettle();
    expect(find.text('Мой первый пост'), findsOneWidget);
  });
}
