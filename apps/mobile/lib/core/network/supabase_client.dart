import '../config/env.dart';
import 'api_client.dart';

class SupabaseClient {
  SupabaseClient({ApiClient? api}) : _api = api ?? ApiClient();

  final ApiClient _api;

  bool get isConfigured => Env.supabaseUrl.startsWith('http') && Env.supabaseAnonKey.isNotEmpty;

  Future<dynamic> select(String table, {Map<String, String>? query}) {
    final suffix = query == null || query.isEmpty ? '' : Uri(queryParameters: query).query;
    return _api.get('/rest/v1/$table$suffix', headers: _headers());
  }

  Future<dynamic> insert(String table, Object data) {
    return _api.post('/rest/v1/$table', data: data, headers: _headers());
  }

  Map<String, String> _headers() {
    return {
      'Authorization': 'Bearer ${Env.supabaseAnonKey}',
      'Prefer': 'return=representation',
    };
  }
}
