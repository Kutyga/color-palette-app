import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../app/providers.dart';
import '../../app/theme.dart';
import '../../shared/widgets.dart';
import 'domain/social.dart';

/// Комментарии как в TikTok: лист на 70% экрана поверх ленты, поле ввода прижато к клавиатуре.
Future<void> showCommentsSheet(BuildContext context, FeedPost post) => showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (_) => FractionallySizedBox(heightFactor: 0.72, child: CommentsSheet(post: post)),
    );

class CommentsSheet extends ConsumerStatefulWidget {
  const CommentsSheet({super.key, required this.post});

  final FeedPost post;

  @override
  ConsumerState<CommentsSheet> createState() => _CommentsSheetState();
}

class _CommentsSheetState extends ConsumerState<CommentsSheet> {
  final _text = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _text.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      await ref.read(socialRepositoryProvider).addComment(widget.post.id, text);
      HapticFeedback.lightImpact();
      _text.clear();
      ref.invalidate(commentsProvider(widget.post.id));
      ref.invalidate(feedProvider);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Не удалось отправить: $e')));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _delete(PostComment c) async {
    await ref.read(socialRepositoryProvider).deleteComment(c.id);
    ref.invalidate(commentsProvider(widget.post.id));
    ref.invalidate(feedProvider);
  }

  @override
  Widget build(BuildContext context) {
    final comments = ref.watch(commentsProvider(widget.post.id));
    final count = comments.value?.length;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Column(
        children: [
          Text(
            count == null ? 'Комментарии' : '$count ${plural(count, 'комментарий', 'комментария', 'комментариев')}',
            style: context.text.titleMedium,
          ),
          const SizedBox(height: 8),
          const Divider(height: 1),
          Expanded(
            child: switch (comments) {
              AsyncData(:final value) when value.isEmpty => const EmptyState(
                  icon: Icons.chat_bubble_outline_rounded,
                  title: 'Пока без комментариев',
                  message: 'Спросите про уход или просто похвалите растение.',
                ),
              AsyncData(:final value) => ListView.builder(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: value.length,
                  itemBuilder: (context, i) => _CommentTile(comment: value[i], onDelete: () => _delete(value[i])),
                ),
              AsyncError(:final error) => ErrorView(error, onRetry: () => ref.invalidate(commentsProvider(widget.post.id))),
              _ => const Center(child: CircularProgressIndicator.adaptive()),
            },
          ),
          const Divider(height: 1),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(GardenTheme.gutter, 8, 8, 8),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _text,
                      maxLength: 1000,
                      minLines: 1,
                      maxLines: 4,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: const InputDecoration(hintText: 'Добавить комментарий…', counterText: ''),
                      onChanged: (_) => setState(() {}),
                      onSubmitted: (_) => _send(),
                    ),
                  ),
                  const SizedBox(width: 4),
                  IconButton.filled(
                    tooltip: 'Отправить',
                    onPressed: _text.text.trim().isEmpty || _sending ? null : _send,
                    icon: const Icon(Icons.arrow_upward_rounded),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CommentTile extends StatelessWidget {
  const _CommentTile({required this.comment, required this.onDelete});

  final PostComment comment;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final c = context.garden;
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: GardenTheme.gutter),
      leading: CircleAvatar(
        backgroundColor: c.leaf.withValues(alpha: 0.14),
        child: Text(comment.authorName.characters.first.toUpperCase(), style: TextStyle(color: c.leaf)),
      ),
      title: Text.rich(
        TextSpan(children: [
          TextSpan(text: '${comment.authorName}  ', style: context.text.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
          TextSpan(text: DateFormat('d MMM, HH:mm', 'ru').format(comment.createdAt), style: context.text.labelMedium),
        ]),
      ),
      subtitle: Text(comment.text, style: context.text.bodyMedium),
      trailing: comment.mine
          ? IconButton(tooltip: 'Удалить', icon: Icon(Icons.delete_outline_rounded, color: c.secondaryLabel), onPressed: onDelete)
          : null,
    );
  }
}
