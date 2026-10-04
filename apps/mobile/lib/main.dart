import 'package:flutter/widgets.dart';
import 'app.dart';
import 'core/network/api_client.dart';
import 'core/services/notification_service.dart';
import 'core/services/offline_sync_service.dart';
import 'core/storage/secure_storage_service.dart';
import 'features/auth/providers/auth_provider.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final storage = SecureStorageService();
  final api = ApiClient();
  final controller = AuthProvider(
    storage: storage,
    offline: OfflineSyncService(api: api, storage: storage),
    notifications: NotificationService(),
  );
  await controller.restoreSession();
  runApp(AfyaCommerceApp(controller: controller));
}
