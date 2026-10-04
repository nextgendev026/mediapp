import 'package:flutter/services.dart';

class NotificationService {
  static const _channel = MethodChannel('com.afyacommerce/notifications');

  Future<void> initialize() async {
    try {
      await _channel.invokeMethod('initialize');
    } on MissingPluginException {} on PlatformException {}
  }

  Future<void> show({
    required String title,
    required String body,
    String? id,
  }) async {
    try {
      await _channel.invokeMethod('show', {'id': id, 'title': title, 'body': body});
    } on MissingPluginException {} on PlatformException {}
  }
}
