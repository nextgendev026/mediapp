import 'package:flutter/services.dart';

class LocationService {
  static const _channel = MethodChannel('com.afyacommerce/location');

  Future<LocationPoint?> getCurrentPosition() async {
    try {
      final result = await _channel.invokeMethod<Map<Object?, Object?>>('getCurrentPosition');
      if (result == null) return null;
      return LocationPoint(
        latitude: (result['latitude'] as num?)?.toDouble() ?? 0,
        longitude: (result['longitude'] as num?)?.toDouble() ?? 0,
        accuracy: (result['accuracy'] as num?)?.toDouble(),
      );
    } on PlatformException {
      return null;
    } on MissingPluginException {
      return null;
    }
  }
}

class LocationPoint {
  const LocationPoint({
    required this.latitude,
    required this.longitude,
    this.accuracy,
  });

  final double latitude;
  final double longitude;
  final double? accuracy;
}
