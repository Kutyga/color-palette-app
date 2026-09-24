import 'dart:typed_data';

import '../features/care/domain/care_models.dart';
import '../features/care/domain/care_type.dart';
import '../features/collection/domain/plant.dart';
import '../features/gamification/domain/gamification.dart';
import '../features/knowledge_base/domain/species.dart';

/// Единая точка доступа к данным сада. Реализации:
/// [SupabaseGardenRepository] — боевой бэкенд, [DemoGardenRepository] — в памяти
/// (демо-режим без сервера и тесты).
abstract interface class GardenRepository {
  Future<List<Plant>> myPlants();
  Future<PlantDetails> plantDetails(String plantId);
  Future<Plant> addPlant(NewPlant draft);
  Future<void> deletePlant(String plantId);

  /// Загружает фото (JPEG) и делает его обложкой растения.
  Future<void> setPlantPhoto(String plantId, Uint8List jpeg);

  Future<List<Location>> myLocations();
  Future<Location> addLocation(String name, LightLevel? light);

  /// Задачи ухода со сроком до [until] (включая просроченные).
  Future<List<CareTask>> dueTasks(DateTime until);
  /// [id] задаёт клиент — повторная отправка той же отметки не создаёт дубль.
  Future<void> logCare(String plantId, CareType type, {String? id, DateTime? performedAt, String? note});

  Future<List<Species>> searchSpecies(String query);
  Future<List<Species>> popularSpecies();
  Future<Species?> species(String id);

  /// Статистика для уровней и достижений.
  Future<GardenStats> stats();
}
