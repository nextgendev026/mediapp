import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SecureStorageService {
  SecureStorageService({FlutterSecureStorage? secureStorage})
      : _secureStorage = secureStorage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _secureStorage;
  static const _sessionKey = 'afya_session';
  static const _queueKey = 'afya_sync_queue';

  Future<void> saveSession(Map<String, dynamic> session) async {
    await _secureStorage.write(key: _sessionKey, value: jsonEncode(session));
  }

  Future<Map<String, dynamic>?> readSession() async {
    final value = await _secureStorage.read(key: _sessionKey);
    if (value == null || value.isEmpty) return null;
    try {
      return Map<String, dynamic>.from(jsonDecode(value) as Map);
    } catch (_) {
      return null;
    }
  }

  Future<void> clearSession() => _secureStorage.delete(key: _sessionKey);

  Future<void> cacheJson(String key, Object value) async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString('cache:$key', jsonEncode(value));
  }

  Future<dynamic> readCachedJson(String key) async {
    final preferences = await SharedPreferences.getInstance();
    final value = preferences.getString('cache:$key');
    if (value == null) return null;
    try {
      return jsonDecode(value);
    } catch (_) {
      return null;
    }
  }

  Future<void> enqueue(Map<String, dynamic> action) async {
    final preferences = await SharedPreferences.getInstance();
    final current = preferences.getStringList(_queueKey) ?? <String>[];
    current.add(jsonEncode(action));
    await preferences.setStringList(_queueKey, current);
  }

  Future<List<Map<String, dynamic>>> readQueue() async {
    final preferences = await SharedPreferences.getInstance();
    final values = preferences.getStringList(_queueKey) ?? <String>[];
    final result = <Map<String, dynamic>>[];
    for (final value in values) {
      try {
        result.add(Map<String, dynamic>.from(jsonDecode(value) as Map));
      } catch (_) {}
    }
    return result;
  }

  Future<void> clearQueue() async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.remove(_queueKey);
  }
}
