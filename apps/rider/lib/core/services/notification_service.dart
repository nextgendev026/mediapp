import 'package:flutter/services.dart';

class NotificationService {
  static const _channel = MethodChannel('com.afyacommerce/notifications');

  Future<void> initialize() async {
    try {
      await _channel.invokeMethod('initialize');
    } on MissingPluginException {} on PlatformException {}
  }

  Future<void> show({required String title, required String body}) async {
    try {
      await _channel.invokeMethod('show', {'title': title, 'body': body, 'id': 'rider'});
    } on MissingPluginException {} on PlatformException {}
  }
}
