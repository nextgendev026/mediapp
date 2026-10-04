import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/env.dart';
import '../network/supabase_auth.dart';

class OrderException implements Exception {
  OrderException(this.message);

  final String message;

  @override
  String toString() => message;
}

class OrderDraft {
  const OrderDraft({
    required this.id,
    required this.orderNumber,
    required this.subtotalKes,
    required this.deliveryFeeKes,
    required this.totalKes,
    required this.itemCount,
  });

  final String id;
  final String orderNumber;
  final double subtotalKes;
  final double deliveryFeeKes;
  final double totalKes;
  final int itemCount;

  factory OrderDraft.fromJson(Map<String, dynamic> json) {
    return OrderDraft(
      id: '${json['id'] ?? ''}',
      orderNumber: '${json['order_number'] ?? json['orderNumber'] ?? ''}',
      subtotalKes: _toDouble(json['subtotal_kes'] ?? json['subtotal']),
      deliveryFeeKes: _toDouble(json['delivery_fee_kes'] ?? json['deliveryFee']),
      totalKes: _toDouble(json['total_kes'] ?? json['total']),
      itemCount: (json['item_count'] as num?)?.toInt() ?? 0,
    );
  }

  static double _toDouble(Object? value) => value is num ? value.toDouble() : double.tryParse('$value') ?? 0;
}

class OrderService {
  OrderService({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Map<String, String> _headers(String accessToken) => {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'apikey': Env.supabaseAnonKey,
        'Authorization': 'Bearer $accessToken',
        'Prefer': 'return=representation',
      };

  Future<OrderDraft> createOrder({
    required SupabaseSession session,
    required List<({String slug, int quantity})> items,
    required String method,
    required String phone,
    required String county,
    required String landmark,
  }) async {
    if (!Env.isConfigured) {
      throw OrderException('This build is missing its server configuration. Contact support.');
    }
    if (items.isEmpty) throw OrderException('Your cart is empty');

    final address = <String, String>{};
    if (method != 'pickup_point') {
      address['phone'] = phone;
      address['county'] = county;
      address['landmark'] = landmark;
    }

    final response = await _client.post(
      Uri.parse('${Env.supabaseUrl.replaceFirst(RegExp(r'/$'), '')}/rest/v1/rpc/create_order'),
      headers: _headers(session.accessToken),
      body: jsonEncode({
        'p_items': [
          for (final item in items) {'slug': item.slug, 'quantity': item.quantity}
        ],
        'p_delivery_address': address,
        'p_delivery_method': method,
        'p_delivery_fee_kes': method == 'pickup_point' ? 0 : 200,
      }),
    );

    if (response.statusCode >= 300) {
      throw OrderException(_reason(response));
    }

    final decoded = jsonDecode(response.body);
    if (decoded is! Map) throw OrderException('We could not create your order. Please try again.');
    final draft = OrderDraft.fromJson(Map<String, dynamic>.from(decoded));
    if (draft.id.isEmpty || draft.orderNumber.isEmpty) {
      throw OrderException('We could not create your order. Please try again.');
    }
    return draft;
  }

  Future<List<OrderDraft>> listOrders(SupabaseSession session) async {
    final response = await _client.get(
      Uri.parse('${Env.supabaseUrl.replaceFirst(RegExp(r'/$'), '')}/rest/v1/orders'
          '?select=id,order_number,total_kes,payment_status,delivery_status,created_at,delivery_address'
          '&order=created_at.desc&limit=25'),
      headers: _headers(session.accessToken),
    );
    if (response.statusCode >= 300) {
      throw OrderException(_reason(response));
    }
    final decoded = jsonDecode(response.body);
    if (decoded is! List) return const [];
    return decoded
        .whereType<Map>()
        .map((row) => OrderDraft.fromJson({
              'id': row['id'],
              'order_number': row['order_number'],
              'total_kes': row['total_kes'],
            }))
        .toList();
  }

  String _reason(http.Response response) {
    const fallback = 'We could not create your order. Please try again.';
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map) {
        final detail = (decoded['message'] ?? decoded['error'] ?? decoded['msg'] ?? decoded['hint'])?.toString() ?? '';
        if (detail.trim().isNotEmpty) {
          if (detail.toLowerCase().contains('consent')) {
            return 'Please accept the processing consent before ordering.';
          }
          return detail;
        }
      }
    } catch (_) {
      return 'We could not reach the pharmacy service. Please try again.';
    }
    return fallback;
  }
}
