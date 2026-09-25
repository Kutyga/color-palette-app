import 'dart:async';
import 'dart:io';

/// Ошибка связи (нет сети, сервер недоступен, таймаут) — в отличие от ошибок
/// данных или прав, которые повторная отправка не исправит.
bool isNetworkError(Object error) {
  if (error is SocketException || error is TimeoutException || error is HttpException) return true;
  // ClientException из package:http и обёртки клиентов Supabase.
  final text = '${error.runtimeType} $error';
  return text.contains('ClientException') ||
      text.contains('SocketException') ||
      text.contains('Failed host lookup') ||
      text.contains('Connection refused') ||
      text.contains('Connection closed') ||
      text.contains('Network is unreachable');
}
