import 'package:shared_preferences/shared_preferences.dart';

/// Простое хранилище строк на устройстве: кэш последних данных и очередь изменений.
/// Данных у одного пользователя немного (десятки растений), поэтому JSON в
/// SharedPreferences достаточно; при росте — заменить на SQLite за тем же интерфейсом.
abstract interface class LocalStore {
  String? read(String key);
  Future<void> write(String key, String value);
  Future<void> remove(String key);
}

class SharedPrefsStore implements LocalStore {
  SharedPrefsStore._(this._prefs);

  final SharedPreferencesWithCache _prefs;

  static Future<SharedPrefsStore> create() async => SharedPrefsStore._(
        await SharedPreferencesWithCache.create(cacheOptions: const SharedPreferencesWithCacheOptions()),
      );

  @override
  String? read(String key) => _prefs.getString(key);

  @override
  Future<void> write(String key, String value) => _prefs.setString(key, value);

  @override
  Future<void> remove(String key) => _prefs.remove(key);
}

class MemoryStore implements LocalStore {
  final _data = <String, String>{};

  @override
  String? read(String key) => _data[key];

  @override
  Future<void> write(String key, String value) async => _data[key] = value;

  @override
  Future<void> remove(String key) async => _data.remove(key);
}
