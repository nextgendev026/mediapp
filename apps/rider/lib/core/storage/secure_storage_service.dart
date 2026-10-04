import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SecureStorageService {
  SecureStorageService({FlutterSecureStorage? secureStorage}) : _secureStorage = secureStorage ?? const FlutterSecureStorage();
  final FlutterSecureStorage _secureStorage;
  static const _sessionKey = 'rider_session';

  Future<void> saveSession(Map<String, dynamic> session) => _secureStorage.write(key: _sessionKey, value: jsonEncode(session));

  Future<Map<String, dynamic>?> readSession() async {
    final value = await _secureStorage.read(key: _sessionKey);
    if (value == null) return null;
    try {
      return Map<String, dynamic>.from(jsonDecode(value) as Map);
    } catch (_) {
      return null;
    }
  }

  Future<void> clearSession() => _secureStorage.delete(key: _sessionKey);

  Future<void> enqueue(Map<String, dynamic> action) async {
    final preferences = await SharedPreferences.getInstance();
    final values = preferences.getStringList('rider_queue') ?? <String>[];
    values.add(jsonEncode(action));
    await preferences.setStringList('rider_queue', values);
  }

  Future<List<Map<String, dynamic>>> readQueue() async {
    final preferences = await SharedPreferences.getInstance();
    final values = preferences.getStringList('rider_queue') ?? <String>[];
    return values.map((value) {
      try {
        return Map<String, dynamic>.from(jsonDecode(value) as Map);
      } catch (_) {
        return <String, dynamic>{};
      }
    }).where((value) => value.isNotEmpty).toList();
  }

  Future<void> clearQueue() async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.remove('rider_queue');
  }
}
