import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/providers.dart';
import '../../app/theme.dart';
import '../../shared/widgets.dart';
import '../care/domain/care_models.dart';

/// Главный экран: что сделать сегодня. Кольца как в Apple Fitness,
/// «истории» как в Instagram, свайп-действия как в Mail.
class TodayScreen extends ConsumerStatefulWidget {
  const TodayScreen({super.key});

  @override
  ConsumerState<TodayScreen> createState() => _TodayScreenState();
}

class _TodayScreenState extends ConsumerState<TodayScreen> {
  /// Сколько задач выполнено за сегодня в этой сессии — для колец.
  int _doneToday = 0;

  Future<void> _complete(CareTask task) async {
    HapticFeedback.mediumImpact();
    await ref.logCare(task.plantId, task.type);
    if (!mounted) return;
    setState(() => _doneToday++);
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text('${task.type.label}: ${task.plantName} — готово')));
  }

  @override
  Widget build(BuildContext context) {
    final tasks = ref.watch(dueTasksProvider);
    ref.listen(dueTasksProvider, (_, next) {
      if (next case AsyncData(:final value)) ref.read(reminderServiceProvider).reschedule(value);
    });

    final now = DateTime.now();
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () => ref.refresh(dueTasksProvider.future),
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: LargeTitle(
                  overline: DateFormat('EEEE, d MMMM', 'ru').format(now),
                  title: 'Сегодня',
                  trailing: IconButton.filledTonal(
                    tooltip: 'Профиль',
                    onPressed: () => context.push('/profile'),
                    icon: const Icon(Icons.person_rounded),
                  ),
                ),
              ),
              ...switch (tasks) {
                AsyncData(:final value) => _content(context, value, now),
                AsyncError(:final error) => [
                    SliverFillRemaining(child: ErrorView(error, onRetry: () => ref.invalidate(dueTasksProvider))),
                  ],
                _ => [const SliverFillRemaining(child: Center(child: CircularProgressIndicator.adaptive()))],
              },
              const SliverToBoxAdapter(child: SizedBox(height: 120)),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _content(BuildContext context, List<CareTask> tasks, DateTime now) {
    final overdue = tasks.where((t) => t.isOverdue(now)).toList();
    final today = tasks.where((t) => t.isDueToday(now)).toList();
    final upcoming = tasks.where((t) => !t.isOverdue(now) && !t.isDueToday(now)).toList();
    final pending = overdue.length + today.length;

    return [
      SliverToBoxAdapter(child: _SummaryCard(done: _doneToday, pending: pending)),
      if (pending > 0) SliverToBoxAdapter(child: _Stories(tasks: [...overdue, ...today])),
      if (pending == 0)
        const SliverToBoxAdapter(
          child: EmptyState(
            icon: Icons.spa_rounded,
            title: 'На сегодня всё',
            message: 'Растения довольны. Загляните в ленту — посмотрите, что растёт у других.',
          ),
        ),
      if (overdue.isNotEmpty) ...[
        SliverToBoxAdapter(child: SectionHeader('Ждут заботы', color: context.garden.alert)),
        _taskList(overdue, now),
      ],
      if (today.isNotEmpty) ...[
        const SliverToBoxAdapter(child: SectionHeader('Сегодня')),
        _taskList(today, now),
      ],
      if (upcoming.isNotEmpty) ...[
        const SliverToBoxAdapter(child: SectionHeader('На неделе')),
        SliverList.list(children: [for (final t in upcoming) _UpcomingRow(task: t, now: now)]),
      ],
    ];
  }

  Widget _taskList(List<CareTask> tasks, DateTime now) => SliverPadding(
        padding: const EdgeInsets.symmetric(horizontal: GardenTheme.gutter),
        sliver: SliverList.separated(
          itemCount: tasks.length,
          separatorBuilder: (_, _) => const SizedBox(height: 10),
          itemBuilder: (context, i) => _TaskCard(
            key: ValueKey(tasks[i].scheduleId),
            task: tasks[i],
            now: now,
            onDone: () => _complete(tasks[i]),
          ),
        ),
      );
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.done, required this.pending});

  final int done;
  final int pending;

  @override
  Widget build(BuildContext context) {
    final total = done + pending;
    final progress = total == 0 ? 1.0 : done / total;
    final c = context.garden;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: GardenTheme.gutter),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Row(
            children: [
              ProgressRing(
                progress: progress,
                color: c.leaf,
                size: 76,
                stroke: 11,
                child: Icon(Icons.water_drop_rounded, color: c.leaf),
              ),
              const SizedBox(width: 18),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      total == 0 ? 'Сегодня без забот' : '$done из $total сделано',
                      style: context.text.titleLarge,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      pending == 0
                          ? 'Все растения в порядке'
                          : 'Ещё $pending ${plural(pending, 'дело', 'дела', 'дел')} по уходу',
                      style: context.text.bodyMedium?.copyWith(color: c.secondaryLabel),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Stories extends StatelessWidget {
  const _Stories({required this.tasks});

  final List<CareTask> tasks;

  @override
  Widget build(BuildContext context) {
    final c = context.garden;
    final now = DateTime.now();
    final byPlant = <String, CareTask>{};
    for (final t in tasks) {
      byPlant.putIfAbsent(t.plantId, () => t);
    }
    return SizedBox(
      height: 112,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(GardenTheme.gutter - 4, 16, GardenTheme.gutter - 4, 0),
        children: [
          for (final t in byPlant.values)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: StoryAvatar(
                seed: t.plantId,
                label: t.plantName,
                ringColors: t.isOverdue(now) ? [c.soil, c.alert] : [c.leaf, c.water],
                onTap: () => context.push('/plant/${t.plantId}'),
              ),
            ),
        ],
      ),
    );
  }
}

class _TaskCard extends StatelessWidget {
  const _TaskCard({super.key, required this.task, required this.now, required this.onDone});

  final CareTask task;
  final DateTime now;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    final c = context.garden;
    final color = c.forCare(task.type);
    final overdue = task.isOverdue(now);
    return Dismissible(
      key: ValueKey('dismiss-${task.scheduleId}'),
      direction: DismissDirection.startToEnd,
      confirmDismiss: (_) async {
        onDone();
        return true;
      },
      background: Container(
        alignment: Alignment.centerLeft,
        padding: const EdgeInsets.only(left: 24),
        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(GardenTheme.radiusMd)),
        child: const Icon(Icons.check_rounded, color: Colors.white, size: 30),
      ),
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => context.push('/plant/${task.plantId}'),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    PlantThumb(seed: task.plantId, size: 56),
                    Positioned(
                      right: -4,
                      bottom: -4,
                      child: CircleAvatar(
                        radius: 13,
                        backgroundColor: Theme.of(context).cardTheme.color,
                        child: CircleAvatar(radius: 11, backgroundColor: color, child: Icon(task.type.icon, size: 14, color: Colors.white)),
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(task.plantName, style: context.text.titleMedium, maxLines: 1, overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 2),
                      Text(
                        overdue ? '${task.type.action} · срок ${relativeDay(task.dueAt, now)}' : task.type.action,
                        style: context.text.bodyMedium?.copyWith(color: overdue ? c.alert : c.secondaryLabel),
                      ),
                    ],
                  ),
                ),
                IconButton.filled(
                  tooltip: task.type.action,
                  style: IconButton.styleFrom(backgroundColor: color.withValues(alpha: 0.14), foregroundColor: color),
                  onPressed: onDone,
                  icon: const Icon(Icons.check_rounded),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _UpcomingRow extends StatelessWidget {
  const _UpcomingRow({required this.task, required this.now});

  final CareTask task;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final color = context.garden.forCare(task.type);
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: GardenTheme.gutter),
      leading: CircleAvatar(backgroundColor: color.withValues(alpha: 0.14), child: Icon(task.type.icon, color: color, size: 20)),
      title: Text(task.plantName, style: context.text.bodyLarge),
      subtitle: Text(task.type.label, style: context.text.bodySmall),
      trailing: Text(relativeDay(task.dueAt, now), style: context.text.labelMedium),
      onTap: () => context.push('/plant/${task.plantId}'),
    );
  }
}
