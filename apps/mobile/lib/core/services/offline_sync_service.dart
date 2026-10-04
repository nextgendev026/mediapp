import 'dart:io';
import '../network/api_client.dart';
import '../storage/secure_storage_service.dart';

class OfflineSyncService {
  OfflineSyncService({required ApiClient api, required SecureStorageService storage})
      : _api = api,
        _storage = storage;

  final ApiClient _api;
  final SecureStorageService _storage;

  Future<bool> get isOnline async {
    try {
      final result = await InternetAddress.lookup('example.com');
      return result.isNotEmpty && result.first.rawAddress.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  Future<dynamic> getWithCache(String path, {String? cacheKey}) async {
    try {
      final value = await _api.get(path);
      if (cacheKey != null) await _storage.cacheJson(cacheKey, value);
      return value;
    } catch (_) {
      return cacheKey == null ? null : _storage.readCachedJson(cacheKey);
    }
  }

  Future<void> enqueue(String path, Map<String, dynamic> payload) {
    return _storage.enqueue({'path': path, 'payload': payload, 'idempotency_key': _api.idempotencyKey(), 'queued_at': DateTime.now().toIso8601String()});
  }

  Future<void> flush() async {
    if (!await isOnline) return;
    final queued = await _storage.readQueue();
    for (final action in queued) {
      final path = action['path'];
      final payload = action['payload'];
      if (path is! String || payload is! Map) continue;
      final key = action['idempotency_key'];
      await _api.post(
        path,
        data: Map<String, dynamic>.from(payload),
        headers: {'Idempotency-Key': key is String && key.isNotEmpty ? key : _api.idempotencyKey()},
      );
    }
    await _storage.clearQueue();
  }

  Future<void> cacheDemoCatalog(List<Map<String, dynamic>> catalog) {
    return _storage.cacheJson('catalog', catalog);
  }
}
