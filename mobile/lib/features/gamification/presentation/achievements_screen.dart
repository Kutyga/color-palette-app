import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../app/theme.dart';
import '../../../shared/widgets.dart';
import '../domain/gamification.dart';

class AchievementsScreen extends ConsumerWidget {
  const AchievementsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stats = ref.watch(gardenStatsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Достижения')),
      body: switch (stats) {
        AsyncData(:final value) => _Body(stats: value),
        AsyncError(:final error) => ErrorView(error, onRetry: () => ref.invalidate(gardenStatsProvider)),
        _ => const Center(child: CircularProgressIndicator.adaptive()),
      },
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.stats});

  final GardenStats stats;

  @override
  Widget build(BuildContext context) {
    final progress = evaluateAchievements(stats);
    final unlocked = progress.where((p) => p.unlocked).length;
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(child: LevelCard(stats: stats)),
        SliverToBoxAdapter(
          child: SectionHeader('Награды · $unlocked из ${progress.length}'),
        ),
        for (final tier in AchievementTier.values) ...[
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(GardenTheme.gutter, 12, GardenTheme.gutter, 8),
              child: Row(
                children: [
                  _TierDot(tier),
                  const SizedBox(width: 8),
                  Text(tier.label, style: context.text.titleMedium),
                  const SizedBox(width: 8),
                  Text('+${tier.xp} XP', style: context.text.labelMedium),
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: GardenTheme.gutter),
            sliver: SliverGrid.builder(
              gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                maxCrossAxisExtent: 180,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 0.78,
              ),
              itemCount: progress.where((p) => p.achievement.tier == tier).length,
              itemBuilder: (context, i) => AchievementBadge(progress: progress.where((p) => p.achievement.tier == tier).elementAt(i)),
            ),
          ),
        ],
        const SliverToBoxAdapter(child: SizedBox(height: 48)),
      ],
    );
  }
}

/// Уровень, опыт и серия — как карточка активности в Apple Fitness.
class LevelCard extends StatelessWidget {
  const LevelCard({
    super.key,
    required this.stats,
    this.padding = const EdgeInsets.fromLTRB(GardenTheme.gutter, 8, GardenTheme.gutter, 0),
  });

  final GardenStats stats;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final lp = levelFor(stats);
    final c = context.garden;
    return Padding(
      padding: padding,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(GardenTheme.radiusLg),
          gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [c.leaf, Color.lerp(c.leaf, c.water, 0.7)!]),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('УРОВЕНЬ ${lp.level.number}', style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w600, letterSpacing: 0.6)),
            const SizedBox(height: 4),
            Text(lp.level.title, style: context.text.headlineSmall?.copyWith(color: Colors.white)),
            const SizedBox(height: 16),
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: lp.fraction),
                duration: const Duration(milliseconds: 700),
                curve: Curves.easeOutCubic,
                builder: (_, v, _) => LinearProgressIndicator(value: v, minHeight: 10, backgroundColor: Colors.white24, color: Colors.white),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              lp.next == null ? '${lp.xp} XP · максимальный уровень' : '${lp.xp} XP · ещё ${lp.xpToNext} до «${lp.next!.title}»',
              style: const TextStyle(color: Colors.white, fontSize: 14),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                _Metric(icon: Icons.local_fire_department_rounded, value: '${stats.currentStreak}', label: 'дней подряд'),
                _Metric(icon: Icons.emoji_events_rounded, value: '${stats.bestStreak}', label: 'лучшая серия'),
                _Metric(icon: Icons.water_drop_rounded, value: '${stats.waterings}', label: 'поливов'),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.icon, required this.value, required this.label});

  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) => Expanded(
        child: Row(
          children: [
            Icon(icon, color: Colors.white, size: 20),
            const SizedBox(width: 6),
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(value, style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)),
                  Text(label, style: const TextStyle(color: Colors.white70, fontSize: 11), maxLines: 1, overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
          ],
        ),
      );
}

class _TierDot extends StatelessWidget {
  const _TierDot(this.tier);

  final AchievementTier tier;

  @override
  Widget build(BuildContext context) => Container(
        width: 14,
        height: 14,
        decoration: BoxDecoration(shape: BoxShape.circle, gradient: LinearGradient(colors: tier.gradient)),
      );
}

class AchievementBadge extends StatelessWidget {
  const AchievementBadge({super.key, required this.progress});

  final AchievementProgress progress;

  @override
  Widget build(BuildContext context) {
    final a = progress.achievement;
    final c = context.garden;
    final hidden = a.secret && !progress.unlocked;
    return Semantics(
      label: '${a.title}, ${progress.unlocked ? 'получено' : 'не получено'}',
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: Theme.of(context).cardTheme.color, borderRadius: BorderRadius.circular(GardenTheme.radiusMd)),
        child: Column(
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: progress.unlocked ? LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: a.tier.gradient) : null,
                color: progress.unlocked ? null : c.surfaceMuted,
                boxShadow: progress.unlocked ? [BoxShadow(color: a.tier.gradient.last.withValues(alpha: 0.35), blurRadius: 12, offset: const Offset(0, 4))] : null,
              ),
              child: Icon(hidden ? Icons.lock_rounded : a.icon, color: progress.unlocked ? Colors.white : c.secondaryLabel, size: 30),
            ),
            const SizedBox(height: 10),
            Text(
              hidden ? 'Секрет' : a.title,
              style: context.text.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),
            Text(
              hidden ? 'Откроется неожиданно' : a.description,
              style: context.text.bodySmall,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const Spacer(),
            if (!progress.unlocked && !hidden) ...[
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(value: progress.fraction, minHeight: 6, color: a.tier.gradient.last, backgroundColor: c.surfaceMuted),
              ),
              const SizedBox(height: 4),
              Text('${progress.current.clamp(0, a.target)} / ${a.target}', style: context.text.labelMedium),
            ] else if (progress.unlocked)
              Text('Получено', style: context.text.labelMedium?.copyWith(color: a.tier.gradient.last)),
          ],
        ),
      ),
    );
  }
}

/// Следит за статистикой и празднует новые достижения и уровни.
class AchievementCelebrations extends ConsumerStatefulWidget {
  const AchievementCelebrations({super.key, required this.messengerKey, required this.child});

  final GlobalKey<ScaffoldMessengerState> messengerKey;
  final Widget child;

  @override
  ConsumerState<AchievementCelebrations> createState() => _AchievementCelebrationsState();
}

class _AchievementCelebrationsState extends ConsumerState<AchievementCelebrations> {
  Set<String>? _unlocked;
  int? _level;

  @override
  Widget build(BuildContext context) {
    ref.listen(gardenStatsProvider, (_, next) {
      final stats = next.value;
      if (stats == null) return;
      final unlocked = {for (final p in evaluateAchievements(stats)) if (p.unlocked) p.achievement.id};
      final level = levelFor(stats).level;
      final messenger = widget.messengerKey.currentState;
      if (_unlocked != null && messenger != null) {
        final fresh = achievements.where((a) => unlocked.contains(a.id) && !_unlocked!.contains(a.id));
        // Праздник важнее обычного «готово» — показываем его сразу.
        if (fresh.isNotEmpty || (_level != null && level.number > _level!)) messenger.hideCurrentSnackBar();
        for (final a in fresh) {
          messenger.showSnackBar(_celebration(a.tier.gradient, a.icon, 'Новое достижение!', '${a.title} · +${a.tier.xp} XP'));
        }
        if (_level != null && level.number > _level!) {
          messenger.showSnackBar(_celebration([const Color(0xFF2E7D4F), const Color(0xFF2F80ED)], Icons.trending_up_rounded, 'Уровень ${level.number}!', level.title));
        }
      }
      _unlocked = unlocked;
      _level = level.number;
    });
    // Подписываемся заранее, чтобы запомнить исходное состояние до первых действий.
    ref.watch(gardenStatsProvider);
    return widget.child;
  }

  SnackBar _celebration(List<Color> gradient, IconData icon, String title, String subtitle) => SnackBar(
        duration: const Duration(seconds: 4),
        content: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(shape: BoxShape.circle, gradient: LinearGradient(colors: gradient)),
              child: Icon(icon, color: Colors.white, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
                  Text(subtitle),
                ],
              ),
            ),
          ],
        ),
      );
}
