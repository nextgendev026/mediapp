class Env {
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.afyacommerce.co.ke',
  );
  static const supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://supabase.afyacommerce.co.ke',
  );
  static const supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: '',
  );
  static const mpesaPaybill = String.fromEnvironment(
    'MPESA_PAYBILL',
    defaultValue: '000000',
  );
  static const enableUssdFallback = bool.fromEnvironment(
    'ENABLE_USSD_FALLBACK',
    defaultValue: true,
  );

  static bool get isConfigured =>
      supabaseUrl.startsWith('https://') && supabaseAnonKey.isNotEmpty;
}

String normalizeKenyanPhone(String input) {
  final digits = input.replaceAll(RegExp(r'[^0-9+]'), '');
  if (digits.startsWith('+254')) return digits;
  if (digits.startsWith('254')) return '+$digits';
  if (digits.startsWith('0')) return '+254${digits.substring(1)}';
  return '+254$digits';
}

bool isValidKenyanPhone(String input) {
  return RegExp(r'^\+254(7\d{8}|1\d{8})$').hasMatch(normalizeKenyanPhone(input));
}
