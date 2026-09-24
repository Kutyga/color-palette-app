import 'package:uuid/uuid.dart';

import '../features/social/domain/social.dart';
import 'garden_repository.dart';
import 'social_repository.dart';

/// Лента и новости в памяти — для демо-режима и тестов.
class DemoSocialRepository implements SocialRepository {
  DemoSocialRepository({required this.garden, DateTime Function()? clock}) : _clock = clock ?? DateTime.now {
    final now = _clock();
    _posts.addAll([
      for (final (i, p) in _samplePosts.indexed)
        FeedPost(
          id: 'demo-post-$i',
          authorId: 'demo-${p.$1}',
          authorName: p.$1,
          plantName: p.$2,
          text: p.$3,
          likeCount: p.$4,
          commentCount: p.$4 ~/ 25,
          createdAt: now.subtract(Duration(hours: 3 + i * 7)),
        ),
    ]);
  }

  final GardenRepository garden;
  final DateTime Function() _clock;
  static const _uuid = Uuid();
  static const _meId = 'me';

  final _posts = <FeedPost>[];
  final _comments = <PostComment>[];

  static const _samplePosts = [
    ('anna.green', 'Монстера Бублик', 'Седьмой резной лист за лето 🌿 Секрет — опора из кокоса и терпение.', 1284),
    ('fikus_papa', 'Роберт', 'Год назад был черенком в стакане. Теперь выше кота.', 932),
    ('succulove', 'Денежка', 'Зимую на прохладном подоконнике, поливаю раз в месяц — и никаких проблем.', 457),
    ('orchid.mood', 'Луна', 'Третье цветение подряд! Полив погружением раз в неделю.', 2110),
  ];

  @override
  Future<List<FeedPost>> feed(FeedTab tab) async {
    final posts = tab == FeedTab.following
        ? _posts.where((p) => p.authorId == _meId || p.authorName == 'anna.green' || p.authorName == 'orchid.mood')
        : _posts;
    return posts.toList()..sort((a, b) => b.createdAt.compareTo(a.createdAt));
  }

  @override
  Future<FeedPost> createPost(NewPost post) async {
    final plant = post.plantId == null ? null : (await garden.myPlants()).where((p) => p.id == post.plantId).firstOrNull;
    final created = FeedPost(
      id: _uuid.v4(),
      authorId: _meId,
      authorName: 'вы',
      text: post.text,
      createdAt: _clock(),
      plantId: post.plantId,
      plantName: plant?.nickname,
      photoBytes: post.photoBytes,
    );
    _posts.add(created);
    return created;
  }

  @override
  Future<List<PostComment>> comments(String postId) async {
    final existing = _comments.where((c) => c.postId == postId).toList();
    if (existing.isNotEmpty || !postId.startsWith('demo-post-')) return existing;
    // У примеров постов есть пара комментариев, чтобы окно не было пустым.
    final now = _clock();
    return [
      PostComment(id: '$postId-c1', postId: postId, authorName: 'fikus_papa', text: 'Какая красота! Чем подкармливаете?', createdAt: now.subtract(const Duration(hours: 2))),
      PostComment(id: '$postId-c2', postId: postId, authorName: 'succulove', text: 'Сохранила себе в вишлист 🌿', createdAt: now.subtract(const Duration(minutes: 40))),
    ];
  }

  @override
  Future<PostComment> addComment(String postId, String text) async {
    final comment = PostComment(id: _uuid.v4(), postId: postId, authorName: 'вы', text: text, createdAt: _clock(), mine: true);
    if (!_comments.any((c) => c.postId == postId)) _comments.addAll(await comments(postId));
    _comments.add(comment);
    _updateCommentCount(postId, 1);
    return comment;
  }

  @override
  Future<void> deleteComment(String commentId) async {
    final i = _comments.indexWhere((c) => c.id == commentId);
    if (i < 0) return;
    _updateCommentCount(_comments.removeAt(i).postId, -1);
  }

  void _updateCommentCount(String postId, int delta) {
    final i = _posts.indexWhere((p) => p.id == postId);
    if (i >= 0) _posts[i] = _posts[i].copyWith(commentCount: _posts[i].commentCount + delta);
  }

  @override
  Future<({int posts, int likesReceived})> myActivity() async {
    final mine = _posts.where((p) => p.authorId == _meId);
    return (posts: mine.length, likesReceived: mine.fold<int>(0, (sum, p) => sum + p.likeCount));
  }

  @override
  Future<void> setLiked(String postId, bool liked) async {
    final i = _posts.indexWhere((p) => p.id == postId);
    if (i < 0 || _posts[i].likedByMe == liked) return;
    _posts[i] = _posts[i].copyWith(likedByMe: liked, likeCount: _posts[i].likeCount + (liked ? 1 : -1));
  }

  @override
  Future<List<NewsArticle>> news({bool onlyMySpecies = false}) async {
    final now = _clock();
    final all = [
      NewsArticle(
        id: 'n1',
        url: 'https://www.botanichka.ru/',
        title: 'Осень на подоконнике: как перевести растения на зимний режим',
        summary: 'Сокращаем полив, убираем подкормки и ищем место посветлее — пять шагов, которые помогут пережить короткий день.',
        sourceName: 'Ботаничка',
        publishedAt: now.subtract(const Duration(hours: 2)),
      ),
      NewsArticle(
        id: 'n2',
        url: 'https://www.sciencedaily.com/news/plants_animals/botany/',
        title: 'Растения «слышат» жужжание пчёл и выделяют больше нектара',
        summary: 'Исследователи обнаружили, что цветы реагируют на вибрации крыльев опылителей за считаные минуты.',
        sourceName: 'ScienceDaily: Botany',
        publishedAt: now.subtract(const Duration(hours: 9)),
      ),
      NewsArticle(
        id: 'n3',
        url: 'https://www.gardeningknowhow.com/',
        title: 'Монстера желтеет? Семь причин и что с ними делать',
        summary: 'Перелив, холодный сквозняк и нехватка света — разбираем частые ошибки ухода за монстерой.',
        sourceName: 'Gardening Know How',
        publishedAt: now.subtract(const Duration(days: 1)),
        speciesIds: const ['demo-monstera'],
      ),
      NewsArticle(
        id: 'n4',
        url: 'https://phys.org/biology-news/plants-animals/',
        title: 'В тропиках Борнео описан новый вид миниатюрной орхидеи',
        summary: 'Цветок размером с ноготь нашли на высоте 1500 метров — ботаники считают, что он опыляется мушками.',
        sourceName: 'Phys.org',
        publishedAt: now.subtract(const Duration(days: 2)),
      ),
    ];
    if (!onlyMySpecies) return all;
    final mine = {for (final p in await garden.myPlants()) ?p.speciesId};
    return all.where((a) => a.speciesIds.any(mine.contains)).toList();
  }
}
