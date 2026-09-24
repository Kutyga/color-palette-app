import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../app/providers.dart';
import '../../app/theme.dart';
import '../../shared/widgets.dart';
import 'domain/social.dart';

/// Лента: «Подписки» и «Интересное» — полноэкранные посты как в TikTok,
/// «Новости» — подборка из открытых источников как в Apple News.
class FeedScreen extends ConsumerStatefulWidget {
  const FeedScreen({super.key});

  @override
  ConsumerState<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends ConsumerState<FeedScreen> {
  int _tab = 1;

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: Colors.black,
        body: Stack(
          children: [
            Positioned.fill(
              child: switch (_tab) {
                0 => const _PostsPager(tab: FeedTab.following),
                1 => const _PostsPager(tab: FeedTab.discover),
                _ => const _NewsList(),
              },
            ),
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Row(
                    children: [
                      const SizedBox(width: 56),
                      Expanded(
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            for (final (i, label) in ['Подписки', 'Интересное', 'Новости'].indexed) ...[
                              if (i > 0) const SizedBox(width: 18),
                              _TabLabel(label, selected: _tab == i, onTap: () => setState(() => _tab = i)),
                            ],
                          ],
                        ),
                      ),
                      SizedBox(
                        width: 56,
                        child: IconButton(
                          tooltip: 'Новый пост',
                          color: Colors.white,
                          onPressed: () => context.push('/post/new'),
                          icon: const Icon(Icons.add_a_photo_outlined),
                        ),
                      ),
                    ],
                  ),
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
  Widget build(BuildContext context) => Semantics(
    selected: selected,
    button: true,
    child: GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Text(
            text,
            style: TextStyle(
              color: selected ? Colors.white : Colors.white60,
              fontSize: 16,
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
    ),
  );
}

class _PostsPager extends ConsumerStatefulWidget {
  const _PostsPager({required this.tab});

  final FeedTab tab;

  @override
  ConsumerState<_PostsPager> createState() => _PostsPagerState();
}

class _PostsPagerState extends ConsumerState<_PostsPager> {
  /// Оптимистичные лайки поверх загруженной ленты.
  final _liked = <String, bool>{};

  Future<void> _setLiked(FeedPost post, bool liked) async {
    if ((_liked[post.id] ?? post.likedByMe) == liked) return;
    HapticFeedback.lightImpact();
    setState(() => _liked[post.id] = liked);
    try {
      await ref.read(socialRepositoryProvider).setLiked(post.id, liked);
    } catch (_) {
      if (mounted) setState(() => _liked.remove(post.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    final posts = ref.watch(feedProvider(widget.tab));
    return switch (posts) {
      AsyncData(:final value) when value.isEmpty => _DarkEmpty(
        icon: Icons.people_outline_rounded,
        title: widget.tab == FeedTab.following ? 'Пока тихо' : 'Лента пуста',
        message: 'Подпишитесь на садоводов из «Интересного» или поделитесь своим растением.',
      ),
      AsyncData(:final value) => RefreshIndicator(
        onRefresh: () => ref.refresh(feedProvider(widget.tab).future),
        child: PageView.builder(
          scrollDirection: Axis.vertical,
          itemCount: value.length,
          itemBuilder: (context, i) {
            final post = value[i];
            final liked = _liked[post.id] ?? post.likedByMe;
            final likes = post.likeCount + (liked == post.likedByMe ? 0 : (liked ? 1 : -1));
            return _PostPage(
              post: post,
              liked: liked,
              likes: likes,
              onLike: () => _setLiked(post, !liked),
              onDoubleTap: () => _setLiked(post, true),
            );
          },
        ),
      ),
      AsyncError(:final error) => _DarkEmpty(icon: Icons.cloud_off_rounded, title: 'Не удалось загрузить', message: '$error'),
      _ => const Center(child: CircularProgressIndicator.adaptive(backgroundColor: Colors.white24)),
    };
  }
}

class _PostPage extends StatefulWidget {
  const _PostPage({required this.post, required this.liked, required this.likes, required this.onLike, required this.onDoubleTap});

  final FeedPost post;
  final bool liked;
  final int likes;
  final VoidCallback onLike;
  final VoidCallback onDoubleTap;

  @override
  State<_PostPage> createState() => _PostPageState();
}

class _PostPageState extends State<_PostPage> with SingleTickerProviderStateMixin {
  late final _heart = AnimationController(vsync: this, duration: const Duration(milliseconds: 700));

  @override
  void dispose() {
    _heart.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final post = widget.post;
    final placeholder = PlantThumb(seed: post.id, radius: 0, iconSize: 160);
    return GestureDetector(
      onDoubleTap: () {
        widget.onDoubleTap();
        _heart.forward(from: 0);
      },
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (post.photoBytes != null)
            Image.memory(post.photoBytes!, fit: BoxFit.cover)
          else if (post.photoUrl != null)
            Image.network(post.photoUrl!, fit: BoxFit.cover, errorBuilder: (_, _, _) => placeholder)
          else
            placeholder,
          // Затемнение сверху и снизу — читаемость вкладок и подписи поверх фото.
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                stops: [0.0, 0.2, 0.55, 1.0],
                colors: [Colors.black45, Colors.transparent, Colors.transparent, Colors.black87],
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
                  color: widget.liked ? context.garden.alert : Colors.white,
                  label: _compact(widget.likes),
                  onTap: widget.onLike,
                  semantics: widget.liked ? 'Убрать лайк' : 'Нравится',
                ),
                _Action(icon: Icons.mode_comment_outlined, label: _compact(post.commentCount), onTap: () {}, semantics: 'Комментарии'),
                _Action(icon: Icons.ios_share_rounded, label: 'Поделиться', onTap: () {}, semantics: 'Поделиться'),
              ],
            ),
          ),
          Positioned(
            left: GardenTheme.gutter,
            right: 88,
            bottom: 110,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      radius: 16,
                      backgroundColor: Colors.white24,
                      child: Text(post.authorName.characters.first.toUpperCase(), style: const TextStyle(color: Colors.white)),
                    ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        '@${post.authorName}',
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text('· ${_ago(post.createdAt)}', style: const TextStyle(color: Colors.white70, fontSize: 13)),
                  ],
                ),
                if (post.plantName != null) ...[
                  const SizedBox(height: 10),
                  Text(
                    post.plantName!,
                    style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700),
                  ),
                ],
                if (post.text.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    post.text,
                    maxLines: 4,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: Colors.white, fontSize: 15, height: 1.35),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  static String _compact(int n) => n >= 1000 ? '${(n / 1000).toStringAsFixed(1).replaceAll('.0', '')}K' : '$n';
}

String _ago(DateTime t) {
  final d = DateTime.now().difference(t);
  if (d.inMinutes < 1) return 'только что';
  if (d.inHours < 1) return '${d.inMinutes} мин';
  if (d.inDays < 1) return '${d.inHours} ч';
  if (d.inDays < 7) return '${d.inDays} д';
  return DateFormat('d MMM', 'ru').format(t);
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
      excludeSemantics: true,
      child: InkResponse(
        onTap: onTap,
        child: Column(
          children: [
            Icon(
              icon,
              color: color,
              size: 34,
              shadows: const [Shadow(blurRadius: 8, color: Colors.black38)],
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      ),
    ),
  );
}

class _NewsList extends ConsumerStatefulWidget {
  const _NewsList();

  @override
  ConsumerState<_NewsList> createState() => _NewsListState();
}

class _NewsListState extends ConsumerState<_NewsList> {
  bool _onlyMine = false;

  Future<void> _open(NewsArticle a) async {
    final ok = await launchUrl(Uri.parse(a.url), mode: LaunchMode.inAppBrowserView);
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Не удалось открыть ссылку')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final news = ref.watch(newsProvider(_onlyMine));
    return Theme(
      data: GardenTheme.dark(),
      child: Builder(
        builder: (context) => SafeArea(
          bottom: false,
          child: RefreshIndicator(
            onRefresh: () => ref.refresh(newsProvider(_onlyMine).future),
            child: CustomScrollView(
              slivers: [
                const SliverToBoxAdapter(child: SizedBox(height: 44)),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(GardenTheme.gutter, 12, GardenTheme.gutter, 8),
                    child: Row(
                      children: [
                        ChoiceChip(
                          label: const Text('Все'),
                          selected: !_onlyMine,
                          showCheckmark: false,
                          onSelected: (_) => setState(() => _onlyMine = false),
                        ),
                        const SizedBox(width: 8),
                        ChoiceChip(
                          label: const Text('Про мои растения'),
                          selected: _onlyMine,
                          showCheckmark: false,
                          onSelected: (_) => setState(() => _onlyMine = true),
                        ),
                      ],
                    ),
                  ),
                ),
                ...switch (news) {
                  AsyncData(:final value) when value.isEmpty => [
                    const SliverFillRemaining(
                      hasScrollBody: false,
                      child: EmptyState(
                        icon: Icons.newspaper_rounded,
                        title: 'Новостей пока нет',
                        message: 'Как только в источниках появятся статьи о ваших растениях, они будут здесь.',
                      ),
                    ),
                  ],
                  AsyncData(:final value) => [
                    SliverToBoxAdapter(
                      child: _HeroNews(article: value.first, onTap: () => _open(value.first)),
                    ),
                    SliverList.separated(
                      itemCount: value.length - 1,
                      separatorBuilder: (_, _) => const Divider(height: 1, indent: GardenTheme.gutter, endIndent: GardenTheme.gutter),
                      itemBuilder: (context, i) => _NewsRow(article: value[i + 1], onTap: () => _open(value[i + 1])),
                    ),
                  ],
                  AsyncError(:final error) => [
                    SliverFillRemaining(child: ErrorView(error, onRetry: () => ref.invalidate(newsProvider(_onlyMine)))),
                  ],
                  _ => [const SliverFillRemaining(child: Center(child: CircularProgressIndicator.adaptive()))],
                },
                const SliverToBoxAdapter(child: SizedBox(height: 120)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _HeroNews extends StatelessWidget {
  const _HeroNews({required this.article, required this.onTap});

  final NewsArticle article;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(GardenTheme.gutter, 8, GardenTheme.gutter, 16),
      child: GestureDetector(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(GardenTheme.radiusLg),
              child: AspectRatio(
                aspectRatio: 16 / 10,
                child: _NewsImage(article: article, iconSize: 72),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              article.sourceName.toUpperCase(),
              style: context.text.labelMedium?.copyWith(color: context.garden.leaf, letterSpacing: 0.4),
            ),
            const SizedBox(height: 4),
            Text(article.title, style: context.text.headlineSmall),
            if (article.summary != null) ...[
              const SizedBox(height: 6),
              Text(
                article.summary!,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: context.text.bodyMedium?.copyWith(color: context.garden.secondaryLabel),
              ),
            ],
            const SizedBox(height: 6),
            Text(_ago(article.publishedAt), style: context.text.labelMedium),
          ],
        ),
      ),
    );
  }
}

class _NewsRow extends StatelessWidget {
  const _NewsRow({required this.article, required this.onTap});

  final NewsArticle article;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: GardenTheme.gutter, vertical: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  article.sourceName.toUpperCase(),
                  style: context.text.labelMedium?.copyWith(color: context.garden.leaf, letterSpacing: 0.4),
                ),
                const SizedBox(height: 4),
                Text(article.title, maxLines: 3, overflow: TextOverflow.ellipsis, style: context.text.titleMedium),
                const SizedBox(height: 6),
                Text(_ago(article.publishedAt), style: context.text.labelMedium),
              ],
            ),
          ),
          const SizedBox(width: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(GardenTheme.radiusSm),
            child: SizedBox.square(dimension: 84, child: _NewsImage(article: article, iconSize: 32)),
          ),
        ],
      ),
    ),
  );
}

class _NewsImage extends StatelessWidget {
  const _NewsImage({required this.article, required this.iconSize});

  final NewsArticle article;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    final placeholder = PlantThumb(seed: article.id, radius: 0, iconSize: iconSize);
    return article.imageUrl == null
        ? placeholder
        : Image.network(article.imageUrl!, fit: BoxFit.cover, errorBuilder: (_, _, _) => placeholder);
  }
}

class _DarkEmpty extends StatelessWidget {
  const _DarkEmpty({required this.icon, required this.title, required this.message});

  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) => Theme(
    data: GardenTheme.dark(),
    child: Center(
      child: EmptyState(icon: icon, title: title, message: message),
    ),
  );
}
