class Env {
  static const apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'https://api.afyacommerce.co.ke');
  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL', defaultValue: 'https://supabase.afyacommerce.co.ke');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY', defaultValue: '');
  static const photoUploadUrl = String.fromEnvironment('PROOF_UPLOAD_URL', defaultValue: '');

  static bool get isConfigured => supabaseAnonKey.isNotEmpty && supabaseUrl.startsWith('http');
}
