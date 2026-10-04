import 'dart:io';
import '../network/api_client.dart';
import '../storage/secure_storage_service.dart';

class OfflineSyncService {
  OfflineSyncService({required ApiClient api, required SecureStorageService storage}) : _api = api, _storage = storage;

  final ApiClient _api;
  final SecureStorageService _storage;

  Future<bool> get isOnline async {
    try {
      final result = await InternetAddress.lookup('one.one.one.one').timeout(const Duration(seconds: 4));
      return result.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  Future<bool> queueIfOffline({required String path, required Map<String, dynamic> body}) async {
    if (await isOnline) {
      await _api.post(path, data: body);
      return true;
    }
    await _storage.enqueue({'path': path, ...body, 'queued_at': DateTime.now().toIso8601String()});
    return false;
  }

  Future<void> flush() async {
    if (!await isOnline) return;
    final queued = await _storage.readQueue();
    for (final action in queued) {
      final path = action['path'];
      if (path is! String) continue;
      final body = Map<String, dynamic>.from(action)..remove('path')..remove('queued_at');
      try {
        await _api.post(path, data: body);
      } catch (_) {
        return;
      }
    }
    await _storage.clearQueue();
  }
}
