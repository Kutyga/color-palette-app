/// Настройки сборки. Передаются так:
/// `flutter run --dart-define-from-file=config/dev.json` (см. config/example.json).
/// Если URL не задан, приложение запускается в демо-режиме без сервера.
abstract final class AppConfig {
  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const supabaseKey = String.fromEnvironment('SUPABASE_PUBLISHABLE_KEY');

  static bool get hasBackend => supabaseUrl.isNotEmpty && supabaseKey.isNotEmpty;
}
