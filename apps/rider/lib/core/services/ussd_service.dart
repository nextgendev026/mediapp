import 'package:flutter/services.dart';

class UssdService {
  static const _channel = MethodChannel('com.afyacommerce/ussd');

  static Future<void> callPatient(String phone) async {
    await _channel.invokeMethod('dialUssd', {'ussdCode': 'tel:$phone'});
  }

  static Future<void> sendSms({required String phone, required String body}) async {
    await _channel.invokeMethod('sendSms', {'phone': phone, 'body': body});
  }
}
