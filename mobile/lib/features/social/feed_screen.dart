import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/theme.dart';
import '../../shared/widgets.dart';

/// Пост ленты. Серверная часть (таблица posts, RPC feed_following / feed_discover)
/// уже есть в миграциях; подключение к API — этап v1.1, сейчас показываем витрину.
class FeedPost {
  const FeedPost({
    required this.id,
    required this.author,
    required this.plantName,
    required this.speciesName,
    required this.text,
    required this.likes,
    required this.comments,
  });

  final String id;
  final String author;
  final String plantName;
  final String speciesName;
  final String text;
  final int likes;
  final int comments;
}

const demoFeed = [
  FeedPost(id: 'p1', author: 'anna.green', plantName: 'Монстера Бублик', speciesName: 'Монстера деликатесная', text: 'Седьмой резной лист за лето 🌿 Секрет — опора из кокоса и терпение.', likes: 1284, comments: 56),
  FeedPost(id: 'p2', author: 'fikus_papa', plantName: 'Роберт', speciesName: 'Фикус каучуконосный', text: 'Год назад был черенком в стакане. Теперь выше кота.', likes: 932, comments: 41),
  FeedPost(id: 'p3', author: 'succulove', plantName: 'Денежка', speciesName: 'Толстянка яйцевидная', text: 'Зимую на прохладном подоконнике, поливаю раз в месяц — и никаких проблем.', likes: 457, comments: 12),
  FeedPost(id: 'p4', author: 'orchid.mood', plantName: 'Луна', speciesName: 'Фаленопсис', text: 'Третье цветение подряд! Полив погружением раз в неделю.', likes: 2110, comments: 98),
];

/// Лента в духе TikTok: полноэкранные карточки, вертикальный снап,
/// действия столбиком справа, вкладки поверх контента, двойной тап — лайк.
class FeedScreen extends StatefulWidget {
  const FeedScreen({super.key, this.posts = demoFeed});

  final List<FeedPost> posts;

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  int _tab = 1;
  final _liked = <String>{};

  void _toggleLike(String id, {bool onlyLike = false}) {
    HapticFeedback.lightImpact();
    setState(() {
      if (_liked.contains(id)) {
        if (!onlyLike) _liked.remove(id);
      } else {
        _liked.add(id);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: Colors.black,
        body: Stack(
          children: [
            PageView.builder(
              scrollDirection: Axis.vertical,
              itemCount: widget.posts.length,
              itemBuilder: (context, i) {
                final post = widget.posts[i];
                return _FeedPage(
                  post: post,
                  liked: _liked.contains(post.id),
                  onLike: () => _toggleLike(post.id),
                  onDoubleTap: () => _toggleLike(post.id, onlyLike: true),
                );
              },
            ),
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _TabLabel('Подписки', selected: _tab == 0, onTap: () => setState(() => _tab = 0)),
                    const SizedBox(width: 20),
                    _TabLabel('Интересное', selected: _tab == 1, onTap: () => setState(() => _tab = 1)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TabLabel extends StatelessWidget {
  const _TabLabel(this.text, {required this.selected, required this.onTap});

  final String text;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Column(
          children: [
            Text(
              text,
              style: TextStyle(
                color: selected ? Colors.white : Colors.white60,
                fontSize: 17,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                shadows: const [Shadow(blurRadius: 8, color: Colors.black38)],
              ),
            ),
            const SizedBox(height: 4),
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: selected ? 24 : 0,
              height: 3,
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(2)),
            ),
          ],
        ),
      );
}

class _FeedPage extends StatefulWidget {
  const _FeedPage({required this.post, required this.liked, required this.onLike, required this.onDoubleTap});

  final FeedPost post;
  final bool liked;
  final VoidCallback onLike;
  final VoidCallback onDoubleTap;

  @override
  State<_FeedPage> createState() => _FeedPageState();
}

class _FeedPageState extends State<_FeedPage> with SingleTickerProviderStateMixin {
  late final _heart = AnimationController(vsync: this, duration: const Duration(milliseconds: 700));

  @override
  void dispose() {
    _heart.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final post = widget.post;
    final c = context.garden;
    return GestureDetector(
      onDoubleTap: () {
        widget.onDoubleTap();
        _heart.forward(from: 0);
      },
      child: Stack(
        fit: StackFit.expand,
        children: [
          PlantThumb(seed: post.id, radius: 0, iconSize: 160),
          // Затемнение снизу — читаемость подписи поверх фото.
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                stops: [0.0, 0.2, 0.6, 1.0],
                colors: [Colors.black38, Colors.transparent, Colors.transparent, Colors.black87],
              ),
            ),
          ),
          Center(
            child: ScaleTransition(
              scale: CurvedAnimation(parent: _heart, curve: Curves.elasticOut),
              child: FadeTransition(
                opacity: ReverseAnimation(CurvedAnimation(parent: _heart, curve: const Interval(0.6, 1))),
                child: const Icon(Icons.favorite_rounded, color: Colors.white, size: 110),
              ),
            ),
          ),
          Positioned(
            right: 12,
            bottom: 110,
            child: Column(
              children: [
                _Action(
                  icon: widget.liked ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                  color: widget.liked ? c.alert : Colors.white,
                  label: _compact(post.likes + (widget.liked ? 1 : 0)),
                  onTap: widget.onLike,
                  semantics: 'Нравится',
                ),
                _Action(icon: Icons.mode_comment_outlined, label: _compact(post.comments), onTap: () {}, semantics: 'Комментарии'),
                _Action(icon: Icons.bookmark_border_rounded, label: 'В вишлист', onTap: () {}, semantics: 'Добавить вид в вишлист'),
                _Action(icon: Icons.ios_share_rounded, label: 'Поделиться', onTap: () {}, semantics: 'Поделиться'),
              ],
            ),
          ),
          Positioned(
            left: GardenTheme.gutter,
            right: 96,
            bottom: 110,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    CircleAvatar(radius: 16, backgroundColor: Colors.white24, child: Text(post.author[0].toUpperCase(), style: const TextStyle(color: Colors.white))),
                    const SizedBox(width: 8),
                    Text('@${post.author}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16)),
                    const SizedBox(width: 10),
                    OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: const BorderSide(color: Colors.white70),
                        visualDensity: VisualDensity.compact,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: () {},
                      child: const Text('Подписаться'),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(post.plantName, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(post.text, style: const TextStyle(color: Colors.white, fontSize: 15, height: 1.35)),
                const SizedBox(height: 10),
                Chip(
                  avatar: const Icon(Icons.eco_rounded, size: 16, color: Colors.white),
                  label: Text(post.speciesName, style: const TextStyle(color: Colors.white)),
                  backgroundColor: Colors.white24,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static String _compact(int n) => n >= 1000 ? '${(n / 1000).toStringAsFixed(1).replaceAll('.0', '')}K' : '$n';
}

class _Action extends StatelessWidget {
  const _Action({required this.icon, required this.label, required this.onTap, required this.semantics, this.color = Colors.white});

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final String semantics;
  final Color color;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 18),
        child: Semantics(
          button: true,
          label: semantics,
          child: InkResponse(
            onTap: onTap,
            child: Column(
              children: [
                Icon(icon, color: color, size: 34, shadows: const [Shadow(blurRadius: 8, color: Colors.black38)]),
                const SizedBox(height: 4),
                Text(label, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
        ),
      );
}
