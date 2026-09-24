import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:tflite_flutter/tflite_flutter.dart';

import '../domain/identification.dart';

/// Распознаёт растение по фото и возвращает латинские названия с уверенностью.
abstract interface class PlantIdentifier {
  Future<List<({String label, double score})>> identify(Uint8List jpeg);
}

/// Распознавание на устройстве: открытая модель Google AIY Vision «plants V1»
/// (TFLite, ~2100 видов, Apache-2.0). Модель скачивается один раз из публичного
/// бакета ml-models проекта Supabase и дальше работает без сети и без ключей.
class TflitePlantIdentifier implements PlantIdentifier {
  TflitePlantIdentifier({required this.modelUrl, required this.labelsUrl});

  final String modelUrl;
  final String labelsUrl;

  Interpreter? _interpreter;
  List<String>? _labels;

  Future<void> _ensureLoaded() async {
    if (_interpreter != null) return;
    final dir = Directory('${(await getApplicationSupportDirectory()).path}/models');
    final model = await _cached(dir, 'plants_v1.tflite', modelUrl);
    final labels = await _cached(dir, 'plants_v1_labels.csv', labelsUrl);
    _labels = parseLabels(await labels.readAsString());
    _interpreter = Interpreter.fromFile(model, options: InterpreterOptions()..threads = 2);
  }

  static Future<File> _cached(Directory dir, String name, String url) async {
    final file = File('${dir.path}/$name');
    if (await file.exists() && await file.length() > 0) return file;
    await dir.create(recursive: true);
    final client = HttpClient();
    try {
      final response = await (await client.getUrl(Uri.parse(url))).close();
      if (response.statusCode != 200) throw HttpException('Модель недоступна: HTTP ${response.statusCode}', uri: Uri.parse(url));
      final tmp = File('${file.path}.part');
      await response.pipe(tmp.openWrite());
      return await tmp.rename(file.path);
    } finally {
      client.close();
    }
  }

  @override
  Future<List<({String label, double score})>> identify(Uint8List jpeg) async {
    await _ensureLoaded();
    final interpreter = _interpreter!;
    final input = interpreter.getInputTensor(0);
    final size = input.shape[1];
    // Декодирование большого JPEG — в отдельном изоляте, чтобы не подвисал интерфейс.
    final rgb = await compute((Uint8List bytes) => preprocessRgb(bytes, size: size), jpeg);

    interpreter.allocateTensors();
    if (input.type == TensorType.float32) {
      input.setTo(Float32List.fromList([for (final v in rgb) v / 255.0]));
    } else {
      input.setTo(rgb);
    }
    interpreter.invoke();

    final output = interpreter.getOutputTensor(0);
    final raw = output.data;
    final List<double> scores;
    if (output.type == TensorType.float32) {
      scores = raw.buffer.asFloat32List(raw.offsetInBytes, raw.lengthInBytes ~/ 4);
    } else {
      final q = output.params;
      final scale = q.scale == 0 ? 1 / 255 : q.scale;
      scores = [for (final v in raw) (v - q.zeroPoint) * scale];
    }
    return topPredictions(scores, _labels!);
  }
}
