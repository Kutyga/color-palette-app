import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../app/providers.dart';
import '../../app/theme.dart';
import '../collection/domain/plant.dart';
import 'domain/social.dart';

/// Новый пост как в Instagram: сначала фото на весь экран, потом подпись.
class CreatePostScreen extends ConsumerStatefulWidget {
  const CreatePostScreen({super.key, this.plantId});

  final String? plantId;

  @override
  ConsumerState<CreatePostScreen> createState() => _CreatePostScreenState();
}

class _CreatePostScreenState extends ConsumerState<CreatePostScreen> {
  final _text = TextEditingController();
  Uint8List? _photo;
  late String? _plantId = widget.plantId;
  PlantVisibility _visibility = PlantVisibility.public;
  bool _publishing = false;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _pick(ImageSource source) async {
    try {
      // Пересжатие до 1600 px: меньше трафика, и платформа заново кодирует файл без исходного EXIF.
      final file = await ImagePicker().pickImage(source: source, maxWidth: 1600, maxHeight: 1600, imageQuality: 85);
      if (file == null) return;
      final bytes = await file.readAsBytes();
      setState(() => _photo = bytes);
    } on PlatformException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Нет доступа к фото: ${e.message}')));
    }
  }

  bool get _canPublish => !_publishing && (_photo != null || _text.text.trim().isNotEmpty);

  Future<void> _publish() async {
    setState(() => _publishing = true);
    try {
      await ref.read(socialRepositoryProvider).createPost(NewPost(
            text: _text.text.trim(),
            plantId: _plantId,
            photoBytes: _photo,
            visibility: _visibility,
          ));
      HapticFeedback.mediumImpact();
      ref.invalidate(feedProvider);
      ref.invalidate(gardenStatsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Пост опубликован')));
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _publishing = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Не удалось опубликовать: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final plants = ref.watch(myPlantsProvider).value ?? const [];
    final c = context.garden;
    return Scaffold(
      appBar: AppBar(
        leading: TextButton(onPressed: () => context.pop(), child: const Text('Отмена')),
        leadingWidth: 96,
        title: const Text('Новый пост'),
        actions: [
          TextButton(
            onPressed: _canPublish ? _publish : null,
            child: _publishing
                ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Опубликовать', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(GardenTheme.gutter, 8, GardenTheme.gutter, 32),
        children: [
          AspectRatio(
            aspectRatio: 4 / 5,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(GardenTheme.radiusLg),
              child: _photo == null
                  ? Container(
                      color: c.surfaceMuted,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.photo_camera_back_rounded, size: 56, color: c.secondaryLabel),
                          const SizedBox(height: 16),
                          Text('Покажите своё растение', style: context.text.titleMedium),
                          const SizedBox(height: 16),
                          Wrap(
                            spacing: 12,
                            children: [
                              FilledButton.tonalIcon(
                                style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
                                onPressed: () => _pick(ImageSource.camera),
                                icon: const Icon(Icons.photo_camera_rounded),
                                label: const Text('Снять'),
                              ),
                              FilledButton.tonalIcon(
                                style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
                                onPressed: () => _pick(ImageSource.gallery),
                                icon: const Icon(Icons.photo_library_rounded),
                                label: const Text('Галерея'),
                              ),
                            ],
                          ),
                        ],
                      ),
                    )
                  : Stack(
                      fit: StackFit.expand,
                      children: [
                        Image.memory(_photo!, fit: BoxFit.cover),
                        Positioned(
                          top: 10,
                          right: 10,
                          child: IconButton.filled(
                            tooltip: 'Убрать фото',
                            style: IconButton.styleFrom(backgroundColor: Colors.black45),
                            onPressed: () => setState(() => _photo = null),
                            icon: const Icon(Icons.close_rounded, color: Colors.white),
                          ),
                        ),
                      ],
                    ),
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _text,
            maxLines: 5,
            minLines: 2,
            maxLength: 2000,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(hintText: 'Что нового? Новый лист, цветение, вопрос сообществу…'),
            onChanged: (_) => setState(() {}),
          ),
          if (plants.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text('Растение', style: context.text.labelMedium),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final p in plants)
                  ChoiceChip(
                    label: Text(p.nickname),
                    selected: _plantId == p.id,
                    showCheckmark: false,
                    onSelected: (sel) => setState(() => _plantId = sel ? p.id : null),
                  ),
              ],
            ),
          ],
          const SizedBox(height: 20),
          Text('Кто видит', style: context.text.labelMedium),
          const SizedBox(height: 8),
          SegmentedButton<PlantVisibility>(
            showSelectedIcon: false,
            segments: const [
              ButtonSegment(value: PlantVisibility.followers, label: Text('Подписчики')),
              ButtonSegment(value: PlantVisibility.public, label: Text('Все')),
            ],
            selected: {_visibility},
            onSelectionChanged: (s) => setState(() => _visibility = s.first),
          ),
        ],
      ),
    );
  }
}
