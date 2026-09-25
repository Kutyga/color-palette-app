import 'dart:typed_data';

import 'package:image/image.dart' as img;
import 'package:image_picker_platform_interface/image_picker_platform_interface.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';

/// JPEG из двух половин: слева [left], справа [right].
Uint8List jpeg(int width, int height, {img.Color? left, img.Color? right}) {
  final image = img.Image(width: width, height: height);
  for (final p in image) {
    final c = p.x < width / 2 ? (left ?? img.ColorRgb8(200, 0, 0)) : (right ?? img.ColorRgb8(0, 0, 200));
    p
      ..r = c.r
      ..g = c.g
      ..b = c.b;
  }
  return img.encodeJpg(image, quality: 95);
}

/// Подменяет камеру: отдаёт [bytes] и запоминает, какой источник запрашивали.
class FakeImagePicker extends ImagePickerPlatform with MockPlatformInterfaceMixin {
  FakeImagePicker(this.bytes);

  final Uint8List bytes;
  final sources = <ImageSource>[];

  @override
  Future<XFile?> getImageFromSource({required ImageSource source, ImagePickerOptions options = const ImagePickerOptions()}) async {
    sources.add(source);
    return XFile.fromData(bytes, name: 'plant.jpg', mimeType: 'image/jpeg');
  }
}
