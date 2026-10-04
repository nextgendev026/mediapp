import 'dart:convert';
import 'dart:io';
import 'api_client.dart';

class DispatchApiException implements Exception {
  DispatchApiException(this.statusCode, this.message);

  final int statusCode;
  final String message;

  @override
  String toString() => message;
}

class AssignedDelivery {
  const AssignedDelivery({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.pickup,
    required this.dropoff,
    required this.patientPhone,
    required this.proofRecorded,
  });

  final String id;
  final String orderNumber;
  final String status;
  final String pickup;
  final String dropoff;
  final String patientPhone;
  final bool proofRecorded;

  bool get isActive => status == 'dispatched' || status == 'in_transit';
  bool get isDelivered => status == 'delivered';

  static AssignedDelivery fromJson(Map<String, dynamic> json) {
    final pharmacy = json['pharmacy'] is Map ? Map<String, dynamic>.from(json['pharmacy'] as Map) : <String, dynamic>{};
    final address = json['delivery_address'] is Map ? Map<String, dynamic>.from(json['delivery_address'] as Map) : <String, dynamic>{};
    final proof = json['proof_of_delivery'];
    return AssignedDelivery(
      id: '${json['id'] ?? ''}',
      orderNumber: '${json['order_number'] ?? ''}',
      status: '${json['delivery_status'] ?? 'pending'}',
      pickup: '${pharmacy['name'] ?? 'Pharmacy'}${pharmacy['physical_address'] == null ? '' : ' • ${pharmacy['physical_address']}'}',
      dropoff: [address['landmark'], address['county']].whereType<String>().where((value) => value.isNotEmpty).join(', '),
      patientPhone: '${address['phone'] ?? ''}',
      proofRecorded: proof is Map && proof.isNotEmpty,
    );
  }
}

class DispatchApi {
  DispatchApi({required ApiClient api}) : _api = api;

  final ApiClient _api;

  Future<List<AssignedDelivery>> listDeliveries() async {
    final response = await _api.get('/dispatch/orders');
    final payload = response is Map ? response : <String, dynamic>{};
    final orders = payload['orders'];
    if (orders is! List) return const [];
    return orders.whereType<Map>().map((order) => AssignedDelivery.fromJson(Map<String, dynamic>.from(order))).toList();
  }

  Future<void> setAvailability({required bool available, double? lat, double? lng}) async {
    await _api.post('/dispatch/availability', data: {
      'isAvailable': available,
      if (lat != null) 'lat': lat,
      if (lng != null) 'lng': lng,
    });
  }

  Future<void> accept(String orderId) async {
    await _api.post('/dispatch/orders/$orderId/accept', data: <String, dynamic>{});
  }

  Future<String> uploadProofPhoto({required String orderId, required File photo}) async {
    final bytes = await photo.readAsBytes();
    if (bytes.isEmpty || bytes.length > 4 * 1024 * 1024) {
      throw const DispatchApiException(0, 'The delivery photo is missing or too large.');
    }
    final response = await _api.post('/dispatch/orders/$orderId/proof/photo', data: {
      'image': base64Encode(bytes),
      'contentType': 'image/jpeg',
    });
    final payload = response is Map ? response : <String, dynamic>{};
    final url = payload['url'];
    if (url is! String || !url.startsWith('https://')) {
      throw const DispatchApiException(0, 'The photo upload did not return a usable link.');
    }
    return url;
  }

  Future<void> submitProof({
    required String orderId,
    required String photoUrl,
    required String otp,
    required double lat,
    required double lng,
  }) async {
    await _api.post('/dispatch/orders/$orderId/proof', data: {
      'photoUrl': photoUrl,
      'otp': otp,
      'gps': {'lat': lat, 'lng': lng},
      'deliveredAt': DateTime.now().toUtc().toIso8601String(),
    });
  }
}
