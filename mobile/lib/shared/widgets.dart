import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../app/theme.dart';

/// Статус растения по ближайшему поливу.
enum PlantStatus { ok, soon, overdue }

PlantStatus plantStatus(DateTime? nextWaterAt, DateTime now) {
  if (nextWaterAt == null) return PlantStatus.ok;
  final today = DateTime(now.year, now.month, now.day);
  if (nextWaterAt.isBefore(today)) return PlantStatus.overdue;
  if (nextWaterAt.isBefore(today.add(const Duration(days: 2)))) return PlantStatus.soon;
  return PlantStatus.ok;
}

extension PlantStatusColor on PlantStatus {
  Color color(GardenColors c) => switch (this) {
        PlantStatus.ok => c.leaf,
        PlantStatus.soon => c.water,
        PlantStatus.overdue => c.alert,
      };

  String get label => switch (this) {
        PlantStatus.ok => 'Всё хорошо',
        PlantStatus.soon => 'Скоро полив',
        PlantStatus.overdue => 'Ждёт полива',
      };
}

/// «сегодня», «завтра», «через 3 дня», «в пятницу», «2 дня назад».
String relativeDay(DateTime date, DateTime now) {
  final d = DateTime(date.year, date.month, date.day);
  final today = DateTime(now.year, now.month, now.day);
  final diff = d.difference(today).inDays;
  if (diff == 0) return 'сегодня';
  if (diff == 1) return 'завтра';
  if (diff == -1) return 'вчера';
  if (diff < 0) return '${-diff} ${plural(-diff, 'день', 'дня', 'дней')} назад';
  if (diff < 7) return DateFormat('EEEE', 'ru').format(date);
  return 'через $diff ${plural(diff, 'день', 'дня', 'дней')}';
}

String plural(int n, String one, String few, String many) {
  final mod10 = n % 10, mod100 = n % 100;
  if (mod10 == 1 && mod100 != 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/// Заголовок в стиле iOS Large Title: надзаголовок, крупный титул, действие справа.
class LargeTitle extends StatelessWidget {
  const LargeTitle({super.key, required this.title, this.overline, this.trailing});

  final String title;
  final String? overline;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(GardenTheme.gutter, 8, GardenTheme.gutter, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (overline != null)
                  Text(overline!.toUpperCase(), style: context.text.labelMedium?.copyWith(letterSpacing: 0.4)),
                Text(title, style: context.text.displaySmall),
              ],
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }
}

class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.color});

  final String title;
  final Color? color;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(GardenTheme.gutter, 20, GardenTheme.gutter, 8),
        child: Text(title, style: context.text.titleMedium?.copyWith(color: color)),
      );
}

/// Плейсхолдер фото растения: мягкий градиент, стабильный для каждого растения.
class PlantThumb extends StatelessWidget {
  const PlantThumb({super.key, required this.seed, this.size, this.radius = GardenTheme.radiusSm, this.iconSize});

  final String seed;
  final double? size;
  final double radius;
  final double? iconSize;

  static const _palettes = [
    [Color(0xFFB7E4C7), Color(0xFF40916C)],
    [Color(0xFFD8F3DC), Color(0xFF52B788)],
    [Color(0xFFCDE7F0), Color(0xFF3A86A8)],
    [Color(0xFFF6E3C5), Color(0xFFC8643B)],
    [Color(0xFFE2ECC5), Color(0xFF6A994E)],
    [Color(0xFFD4E4DA), Color(0xFF2D6A4F)],
  ];

  @override
  Widget build(BuildContext context) {
    final colors = _palettes[seed.hashCode.abs() % _palettes.length];
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: colors),
      ),
      child: LayoutBuilder(
        builder: (context, box) => Icon(
          Icons.eco_rounded,
          size: iconSize ?? math.min(box.maxWidth, box.maxHeight) * 0.42,
          color: Colors.white.withValues(alpha: 0.9),
        ),
      ),
    );
  }
}

/// Аватар «истории» Instagram: кольцо-градиент показывает статус растения.
class StoryAvatar extends StatelessWidget {
  const StoryAvatar({super.key, required this.seed, required this.label, required this.ringColors, this.onTap});

  final String seed;
  final String label;
  final List<Color> ringColors;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: GestureDetector(
        onTap: onTap,
        child: SizedBox(
          width: 76,
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(2.5),
                decoration: BoxDecoration(shape: BoxShape.circle, gradient: SweepGradient(colors: [...ringColors, ringColors.first])),
                child: Container(
                  padding: const EdgeInsets.all(2.5),
                  decoration: BoxDecoration(shape: BoxShape.circle, color: Theme.of(context).scaffoldBackgroundColor),
                  child: ClipOval(child: PlantThumb(seed: seed, size: 60, radius: 30)),
                ),
              ),
              const SizedBox(height: 6),
              Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.text.labelMedium?.copyWith(color: context.text.bodyLarge?.color)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Кольцо прогресса в стиле Apple Fitness.
class ProgressRing extends StatelessWidget {
  const ProgressRing({super.key, required this.progress, required this.color, this.size = 64, this.stroke = 9, this.child});

  final double progress;
  final Color color;
  final double size;
  final double stroke;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: progress.clamp(0, 1)),
      duration: reduceMotion ? Duration.zero : const Duration(milliseconds: 700),
      curve: Curves.easeOutCubic,
      builder: (context, value, _) => CustomPaint(
        size: Size.square(size),
        painter: _RingPainter(value, color, stroke),
        child: SizedBox.square(dimension: size, child: Center(child: child)),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter(this.progress, this.color, this.stroke);

  final double progress;
  final Color color;
  final double stroke;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final arcRect = rect.deflate(stroke / 2);
    final track = Paint()
      ..color = color.withValues(alpha: 0.18)
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke;
    canvas.drawArc(arcRect, 0, math.pi * 2, false, track);
    if (progress <= 0) return;
    final arc = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = stroke;
    canvas.drawArc(arcRect, -math.pi / 2, math.pi * 2 * progress, false, arc);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.progress != progress || old.color != color;
}

/// Плашка-факт как на странице продукта apple.com: иконка, значение, подпись.
class FactTile extends StatelessWidget {
  const FactTile({super.key, required this.icon, required this.value, required this.label, this.color});

  final IconData icon;
  final String value;
  final String label;
  final Color? color;

  /// Запас высоты под увеличенный системный шрифт (Dynamic Type).
  static double extraHeight(BuildContext context) => (MediaQuery.textScalerOf(context).scale(100) - 100).clamp(0, 120);

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 132,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Theme.of(context).cardTheme.color, borderRadius: BorderRadius.circular(GardenTheme.radiusMd)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color ?? context.garden.leaf, size: 22),
          const SizedBox(height: 10),
          Text(value, style: context.text.titleMedium, maxLines: 2, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 2),
          Text(label, style: context.text.labelMedium, maxLines: 1, overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, required this.message, this.action});

  final IconData icon;
  final String title;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 72, color: context.garden.leaf.withValues(alpha: 0.5)),
          const SizedBox(height: 16),
          Text(title, style: context.text.titleLarge, textAlign: TextAlign.center),
          const SizedBox(height: 8),
          Text(message, style: context.text.bodyMedium?.copyWith(color: context.garden.secondaryLabel), textAlign: TextAlign.center),
          if (action != null) ...[const SizedBox(height: 24), action!],
        ],
      ),
    );
  }
}

class ErrorView extends StatelessWidget {
  const ErrorView(this.error, {super.key, this.onRetry});

  final Object error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: EmptyState(
          icon: Icons.cloud_off_rounded,
          title: 'Не удалось загрузить',
          message: '$error',
          action: onRetry == null ? null : OutlinedButton(onPressed: onRetry, child: const Text('Повторить')),
        ),
      );
}
