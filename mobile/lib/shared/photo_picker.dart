import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

/// Снимает растение камерой и возвращает JPEG до 1600 px.
/// Выбора из галереи нет намеренно: в коллекцию попадают только растения, сфотографированные
/// у себя дома, а не картинки из интернета.
/// Пересжатие заново кодирует файл, поэтому исходный EXIF с геометкой не уходит на сервер.
Future<Uint8List?> pickPlantPhoto(BuildContext context) async {
  try {
    final file = await ImagePicker().pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.rear,
      maxWidth: 1600,
      maxHeight: 1600,
      imageQuality: 85,
    );
    return file == null ? null : await file.readAsBytes();
  } on PlatformException catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Нет доступа к камере: ${e.message}')));
    }
    return null;
  }
}
