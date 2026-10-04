import 'package:flutter/services.dart';

class UssdService {
  static const _channel = MethodChannel('com.afyacommerce/ussd');

  static Future<String?> initiateUssdPayment({
    required String amount,
    required String orderNumber,
    required String paybill,
  }) async {
    final code = '*334*1*$paybill*$orderNumber*${double.parse(amount).round()}#';
    return _channel.invokeMethod<String>('dialUssd', {'ussdCode': code});
  }

  static Future<void> sendSmsOrder({
    required String pharmacyPhone,
    required String orderDetails,
  }) async {
    await _channel.invokeMethod('sendSms', {
      'phone': pharmacyPhone,
      'body': orderDetails,
    });
  }
}
