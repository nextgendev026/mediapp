import 'package:flutter/widgets.dart';
import 'app.dart';
import 'core/network/api_client.dart';
import 'core/services/notification_service.dart';
import 'core/storage/secure_storage_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final controller = RiderController(
    storage: SecureStorageService(),
    api: ApiClient(),
    notifications: NotificationService(),
  );
  await controller.restoreSession();
  runApp(RiderApp(controller: controller));
}
