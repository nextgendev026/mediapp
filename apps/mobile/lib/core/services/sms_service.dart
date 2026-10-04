import 'package:flutter/services.dart';
import '../config/env.dart';

class SmsService {
  static const _channel = MethodChannel('com.afyacommerce/ussd');

  static Future<void> sendOrderRequest({
    required String phone,
    required String message,
  }) async {
    final normalized = normalizeKenyanPhone(phone);
    if (!isValidKenyanPhone(normalized)) {
      throw const FormatException('Enter a valid Kenyan phone number');
    }
    await _channel.invokeMethod('sendSms', {
      'phone': normalized,
      'body': message,
    });
  }
}
