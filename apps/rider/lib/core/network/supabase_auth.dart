import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/env.dart';

class SupabaseAuthException implements Exception {
  SupabaseAuthException(this.message);

  final String message;

  @override
  String toString() => message;
}

class SupabaseSession {
  const SupabaseSession({required this.accessToken, required this.refreshToken, required this.userId, required this.expiresAt});

  final String accessToken;
  final String refreshToken;
  final String userId;
  final DateTime expiresAt;

  bool get isExpired => DateTime.now().isAfter(expiresAt.subtract(const Duration(seconds: 30)));

  Map<String, dynamic> toJson() => {
        'access_token': accessToken,
        'refresh_token': refreshToken,
        'user_id': userId,
        'expires_at': expiresAt.toIso8601String(),
      };

  static SupabaseSession? fromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    final accessToken = json['access_token'];
    final refreshToken = json['refresh_token'];
    final userId = json['user_id'];
    final expiresAt = DateTime.tryParse('${json['expires_at'] ?? ''}');
    if (accessToken is! String || accessToken.isEmpty) return null;
    if (refreshToken is! String || refreshToken.isEmpty) return null;
    if (userId is! String || userId.isEmpty) return null;
    if (expiresAt == null) return null;
    return SupabaseSession(accessToken: accessToken, refreshToken: refreshToken, userId: userId, expiresAt: expiresAt);
  }
}

class SupabaseAuthService {
  SupabaseAuthService({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  String get _base => Env.supabaseUrl.replaceFirst(RegExp(r'/$'), '');

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'apikey': Env.supabaseAnonKey,
        'Accept': 'application/json',
      };

  Future<void> requestOtp(String phone) async {
    _requireConfigured();
    final response = await _client.post(
      Uri.parse('$_base/auth/v1/otp'),
      headers: _headers,
      body: jsonEncode({'phone': phone, 'create_user': false}),
    );
    if (response.statusCode >= 300) throw SupabaseAuthException(_message(response, 'We could not send the code.'));
  }

  Future<SupabaseSession> verifyOtp({required String phone, required String token}) async {
    _requireConfigured();
    final response = await _client.post(
      Uri.parse('$_base/auth/v1/verify'),
      headers: _headers,
      body: jsonEncode({'phone': phone, 'token': token, 'type': 'sms'}),
    );
    if (response.statusCode >= 300) throw SupabaseAuthException(_message(response, 'That code is invalid or expired.'));
    return _sessionFrom(response);
  }

  Future<SupabaseSession> refresh(SupabaseSession current) async {
    _requireConfigured();
    final response = await _client.post(
      Uri.parse('$_base/auth/v1/token?grant_type=refresh_token'),
      headers: _headers,
      body: jsonEncode({'refresh_token': current.refreshToken}),
    );
    if (response.statusCode >= 300) throw SupabaseAuthException(_message(response, 'Your session expired. Please sign in again.'));
    return _sessionFrom(response);
  }

  Future<Map<String, dynamic>> profile(String accessToken) async {
    _requireConfigured();
    final response = await _client.get(
      Uri.parse('$_base/rest/v1/profiles?select=id,role,full_name,is_active,riders(plate_number,transport_licence_number,transport_licence_expiry,county,is_available)'),
      headers: {..._headers, 'Authorization': 'Bearer $accessToken'},
    );
    if (response.statusCode >= 300) throw SupabaseAuthException(_message(response, 'We could not load your rider profile.'));
    final decoded = jsonDecode(response.body);
    if (decoded is! List || decoded.isEmpty || decoded.first is! Map) {
      throw const SupabaseAuthException('No rider profile is linked to this number yet.');
    }
    return Map<String, dynamic>.from(decoded.first as Map);
  }

  Future<void> signOut(SupabaseSession session) async {
    try {
      await _client.post(
        Uri.parse('$_base/auth/v1/logout'),
        headers: {..._headers, 'Authorization': 'Bearer ${session.accessToken}'},
        body: '{}',
      );
    } catch (_) {
      return;
    }
  }

  SupabaseSession _sessionFrom(http.Response response) {
    final decoded = jsonDecode(response.body);
    if (decoded is! Map) throw const SupabaseAuthException('Unexpected sign-in response.');
    final payload = decoded;
    final accessToken = payload['access_token'];
    final refreshToken = payload['refresh_token'];
    final expiresIn = payload['expires_in'];
    final user = payload['user'];
    final userId = user is Map ? user['id'] : null;
    if (accessToken is! String || refreshToken is! String || userId is! String) {
      throw const SupabaseAuthException('Sign-in did not return a usable session.');
    }
    final seconds = expiresIn is int ? expiresIn : 3600;
    return SupabaseSession(
      accessToken: accessToken,
      refreshToken: refreshToken,
      userId: userId,
      expiresAt: DateTime.now().add(Duration(seconds: seconds)),
    );
  }

  void _requireConfigured() {
    if (!Env.isConfigured) {
      throw const SupabaseAuthException('This build is missing its server configuration. Contact support.');
    }
  }

  String _message(http.Response response, String fallback) {
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map) {
        for (final key in ['msg', 'message', 'error_description', 'error']) {
          final value = decoded[key];
          if (value is String && value.trim().isNotEmpty) return value;
        }
      }
    } catch (_) {
      return fallback;
    }
    return fallback;
  }
}
