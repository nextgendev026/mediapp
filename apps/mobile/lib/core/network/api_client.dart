import 'dart:convert';
import 'dart:math';
import 'package:http/http.dart' as http;
import '../config/env.dart';

class ApiClient {
  ApiClient({http.Client? client, String? baseUrl})
      : _client = client ?? http.Client(),
        _baseUrl = (baseUrl ?? Env.apiBaseUrl).replaceFirst(RegExp(r'/$'), ''),
        _random = Random();

  final http.Client _client;
  final String _baseUrl;
  final Random _random;
  String? _authToken;

  void setAuthToken(String? token) => _authToken = token;

  Future<dynamic> get(String path, {Map<String, String>? headers}) async {
    final response = await _client.get(
      Uri.parse('$_baseUrl$path'),
      headers: _headers(headers),
    );
    return _decode(response);
  }

  Future<dynamic> post(
    String path, {
    Object? data,
    Map<String, String>? headers,
  }) async {
    final response = await _client.post(
      Uri.parse('$_baseUrl$path'),
      headers: _headers({
        if (headers == null || !headers.containsKey('Idempotency-Key')) 'Idempotency-Key': idempotencyKey(),
        ...?headers,
        'Content-Type': 'application/json',
      }),
      body: data == null ? null : jsonEncode(data),
    );
    return _decode(response);
  }

  String idempotencyKey() {
    final stamp = DateTime.now().toUtc().microsecondsSinceEpoch.toRadixString(36);
    final salt = _random.nextInt(0x7fffffff).toRadixString(36);
    return 'idem.$stamp.$salt';
  }

  Map<String, String> _headers(Map<String, String>? extra) {
    return {
      'Accept': 'application/json',
      if (Env.supabaseAnonKey.isNotEmpty) 'apikey': Env.supabaseAnonKey,
      if (_authToken != null && _authToken!.isNotEmpty) 'Authorization': 'Bearer $_authToken',
      ...?extra,
    };
  }

  dynamic _decode(http.Response response) {
    dynamic payload;
    if (response.body.isNotEmpty) {
      try {
        payload = jsonDecode(response.body);
      } catch (_) {
        payload = response.body;
      }
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(response.statusCode, payload?.toString());
    }
    return payload;
  }

  void dispose() => _client.close();
}

class ApiException implements Exception {
  ApiException(this.statusCode, this.message);
  final int statusCode;
  final String? message;

  @override
  String toString() => 'ApiException($statusCode): ${message ?? 'Request failed'}';
}
