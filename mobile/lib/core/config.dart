/// Настройки сборки. Передаются так:
/// `flutter run --dart-define-from-file=config/dev.json` (см. config/example.json).
/// Если URL не задан, приложение запускается в демо-режиме без сервера.
abstract final class AppConfig {
  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const supabaseKey = String.fromEnvironment('SUPABASE_PUBLISHABLE_KEY');

  static bool get hasBackend => supabaseUrl.isNotEmpty && supabaseKey.isNotEmpty;

  /// Модель распознавания растений в публичном бакете ml-models (скачивается один раз).
  static String get plantModelUrl => '$supabaseUrl/storage/v1/object/public/ml-models/plants_v1.tflite';
  static String get plantLabelsUrl => '$supabaseUrl/storage/v1/object/public/ml-models/plants_v1_labels.csv';
}
