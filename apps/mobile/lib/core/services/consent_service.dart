import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/env.dart';
import '../network/supabase_auth.dart';

class ConsentRecord {
  const ConsentRecord({required this.type, required this.granted, this.grantedAt, this.revokedAt, this.policyVersion});

  final String type;
  final bool granted;
  final DateTime? grantedAt;
  final DateTime? revokedAt;
  final String? policyVersion;

  factory ConsentRecord.fromJson(Map<String, dynamic> json) {
    return ConsentRecord(
      type: '${json['consent_type'] ?? json['type'] ?? ''}',
      granted: json['granted'] == true,
      grantedAt: DateTime.tryParse('${json['granted_at'] ?? ''}'),
      revokedAt: DateTime.tryParse('${json['revoked_at'] ?? ''}'),
      policyVersion: json['policy_version']?.toString(),
    );
  }
}

class ConsentService {
  ConsentService({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  String get _base => Env.supabaseUrl.replaceFirst(RegExp(r'/$'), '');

  Map<String, String> _headers(SupabaseSession session, {String prefer = 'return=representation'}) => {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'apikey': Env.supabaseAnonKey,
        'Authorization': 'Bearer ${session.accessToken}',
        'Prefer': prefer,
      };

  Future<List<ConsentRecord>> load(SupabaseSession session) async {
    if (!Env.isConfigured) throw const ConsentException('This build is missing its server configuration.');
    final response = await _client.get(
      Uri.parse('$_base/rest/v1/consent_records?select=consent_type,granted,granted_at,revoked_at,policy_version&profile_id=eq.${Uri.encodeComponent(session.userId)}&order=granted_at.desc'),
      headers: _headers(session),
    );
    if (response.statusCode >= 300) throw ConsentException(_reason(response));
    final decoded = jsonDecode(response.body);
    if (decoded is! List) return const [];
    return decoded.whereType<Map>().map((row) => ConsentRecord.fromJson(Map<String, dynamic>.from(row))).toList();
  }

  Future<List<ConsentRecord>> setConsent(SupabaseSession session, {required String type, required bool granted}) async {
    if (!Env.isConfigured) throw const ConsentException('This build is missing its server configuration.');
    if (type == 'phi_processing' && !granted) {
      throw const ConsentException('Treatment consent cannot be withdrawn while an order or consultation is in progress. Contact support.');
    }
    final now = DateTime.now().toUtc().toIso8601String();
    final payload = granted
        ? {
            'profile_id': session.userId,
            'consent_type': type,
            'granted': true,
            'granted_at': now,
            'revoked_at': null,
          }
        : {
            'profile_id': session.userId,
            'consent_type': type,
            'granted': false,
            'revoked_at': now,
          };

    final insert = await _client.post(
      Uri.parse('$_base/rest/v1/consent_records'),
      headers: _headers(session),
      body: jsonEncode(payload),
    );
    if (insert.statusCode >= 300) throw ConsentException(_reason(insert));
    return load(session);
  }

  String _reason(http.Response response) {
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map) {
        final detail = (decoded['message'] ?? decoded['error'] ?? decoded['hint'])?.toString() ?? '';
        if (detail.trim().isNotEmpty) return detail;
      }
    } catch (_) {
      return 'We could not reach the consent service.';
    }
    return 'We could not save your consent preference.';
  }
}

class ConsentException implements Exception {
  ConsentException(this.message);

  final String message;

  @override
  String toString() => message;
}
