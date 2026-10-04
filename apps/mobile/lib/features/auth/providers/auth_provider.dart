import 'package:flutter/foundation.dart';
import '../../../core/config/env.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/supabase_auth.dart';
import '../../../core/services/location_service.dart';
import '../../../core/services/mpesa_service.dart';
import '../../../core/services/notification_service.dart';
import '../../../core/services/offline_sync_service.dart';
import '../../../core/services/order_service.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../../../core/services/sms_service.dart';
import '../../../core/services/ussd_service.dart';
import '../../../shared/models/consultation.dart';
import '../../../shared/models/order.dart';
import '../../../shared/models/prescription.dart';
import '../../../shared/models/product.dart';

class AuthProvider extends ChangeNotifier {
  AuthProvider({
    required SecureStorageService storage,
    required OfflineSyncService offline,
    required NotificationService notifications,
    SupabaseAuthService? auth,
    OrderService? orders,
  })  : _storage = storage,
        _offline = offline,
        _notifications = notifications,
        _auth = auth ?? SupabaseAuthService(),
        _orders_service = orders ?? OrderService() {
    _prescriptions.addAll(_seedPrescriptions());
    _consultations.addAll(_seedConsultations());
  }

  final SecureStorageService _storage;
  final OfflineSyncService _offline;
  final NotificationService _notifications;
  final SupabaseAuthService _auth;
  final OrderService _orders_service;
  final ApiClient _api = ApiClient();
  late final MpesaService mpesa = MpesaService(api: _api);
  final UssdService ussd = UssdService();
  final SmsService sms = SmsService();
  final LocationService location = LocationService();

  bool _loading = false;
  bool _restored = false;
  bool _authenticated = false;
  bool _consentGiven = false;
  String _phone = '';
  String _name = '';
  String _language = 'en';
  String? _lastError;
  SupabaseSession? _session;
  String? _pendingName;
  final Map<String, int> _cart = {};
  final List<Order> _orders = [];
  final List<Prescription> _prescriptions = [];
  final List<Consultation> _consultations = [];
  late final List<Product> _catalog = _seedCatalog();

  bool get loading => _loading;
  bool get restored => _restored;
  bool get authenticated => _authenticated;
  bool get consentGiven => _consentGiven;
  String get phone => _phone;
  String get name => _name;
  String get language => _language;
  String? get lastError => _lastError;
  List<Product> get catalog => List.unmodifiable(_catalog);
  List<Order> get orders => List.unmodifiable(_orders);
  List<Prescription> get prescriptions => List.unmodifiable(_prescriptions);
  List<Consultation> get consultations => List.unmodifiable(_consultations);
  int get cartCount => _cart.values.fold(0, (sum, quantity) => sum + quantity);
  double get cartTotal => _cart.entries.fold<double>(0, (sum, entry) {
        final product = _catalog.firstWhere((item) => item.id == entry.key);
        return sum + product.priceKes * entry.value;
      });

  bool cartContains(String productId) => _cart.containsKey(productId);

  int cartQuantity(String productId) => _cart[productId] ?? 0;

  Future<void> restoreSession() async {
    await _notifications.initialize();
    final stored = SupabaseSession.fromJson(await _storage.readSession());
    if (stored != null) {
      var session = stored;
      if (session.isExpired) {
        try {
          session = await _auth.refresh(session);
          await _storage.saveSession(session.toJson());
        } catch (_) {
          await _storage.clearSession();
          _restored = true;
          notifyListeners();
          return;
        }
      }
      await _adopt(session);
    }
    _restored = true;
    notifyListeners();
  }

  Future<bool> requestOtp(String input, {bool createUser = false, Map<String, String> metadata = const {}}) async {
    _loading = true;
    _lastError = null;
    notifyListeners();
    try {
      if (!isValidKenyanPhone(input)) {
        _lastError = 'Enter a valid Kenyan mobile number';
        return false;
      }
      if (!Env.isConfigured) {
        _lastError = 'This build is missing its server configuration. Contact support.';
        return false;
      }
      _phone = normalizeKenyanPhone(input);
      await _auth.requestOtp(_phone, createUser: createUser, metadata: metadata);
      return true;
    } on SupabaseAuthException catch (error) {
      _lastError = error.message;
      return false;
    } catch (_) {
      _lastError = 'We could not send the code. Check your network and try again.';
      return false;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<bool> verifyOtp(String code) async {
    _loading = true;
    _lastError = null;
    notifyListeners();
    try {
      if (code.trim().length < 6) {
        _lastError = 'Enter the 6-digit code sent to $_phone';
        return false;
      }
      final session = await _auth.verifyOtp(phone: _phone, token: code.trim());
      await _storage.saveSession(session.toJson());
      await _adopt(session);
      await _notifications.show(title: 'Welcome to AfyaCommerce', body: 'Your health services are ready.');
      return true;
    } on SupabaseAuthException catch (error) {
      _lastError = error.message;
      return false;
    } catch (_) {
      _lastError = 'We could not verify that code. Please try again.';
      return false;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<bool> startRegistration({required String fullName, required String phone, required bool consent}) async {
    _lastError = null;
    notifyListeners();
    if (fullName.trim().isEmpty) {
      _lastError = 'Enter your full name';
      notifyListeners();
      return false;
    }
    if (!consent) {
      _lastError = 'Consent is required to process health information';
      notifyListeners();
      return false;
    }
    _pendingName = fullName.trim();
    return requestOtp(
      phone,
      createUser: true,
      metadata: {'full_name': _pendingName, 'role': 'patient', 'phi_consent': 'true'},
    );
  }

  Future<void> logout() async {
    final session = _session;
    if (session != null) await _auth.signOut(session);
    _session = null;
    _authenticated = false;
    _consentGiven = false;
    _name = '';
    _cart.clear();
    _orders.clear();
    _api.setAuthToken(null);
    await _storage.clearSession();
    notifyListeners();
  }

  void setLanguage(String value) {
    _language = value;
    notifyListeners();
  }

  void addToCart(Product product) {
    final current = _cart[product.id] ?? 0;
    _cart[product.id] = current + 1;
    notifyListeners();
  }

  void removeFromCart(String productId) {
    final current = _cart[productId] ?? 0;
    if (current <= 1) {
      _cart.remove(productId);
    } else {
      _cart[productId] = current - 1;
    }
    notifyListeners();
  }

  List<({String slug, int quantity})> get _cartItems => _cart.entries
      .map((entry) => (slug: entry.key, quantity: entry.value))
      .toList(growable: false);

  Future<Order> reserveOrder({
    required String landmark,
    required String deliveryMethod,
    required String county,
    required String phone,
  }) async {
    final session = _requireSession();
    if (!_consentGiven) {
      throw const OrderException('Please accept the processing consent before ordering.');
    }
    _loading = true;
    _lastError = null;
    notifyListeners();
    try {
      final method = switch (deliveryMethod) {
        'pickup' => 'pickup_point',
        'clinic' => 'clinic_collection',
        _ => 'boda',
      };
      final draft = await _orders_service.createOrder(
        session: session,
        items: _cartItems,
        method: method,
        phone: normalizeKenyanPhone(phone),
        county: county,
        landmark: landmark.trim(),
      );
      final order = Order(
        id: draft.id,
        orderNumber: draft.orderNumber,
        createdAt: DateTime.now(),
        totalKes: draft.totalKes,
        paymentStatus: 'pending',
        deliveryStatus: method == 'pickup_point' ? 'confirmed' : 'pending',
        items: cartCount,
        landmark: landmark.trim(),
      );
      _orders.insert(0, order);
      _cart.clear();
      return order;
    } on OrderException catch (error) {
      _lastError = error.message;
      rethrow;
    } catch (_) {
      _lastError = 'We could not reach the pharmacy service. Please try again.';
      rethrow OrderException(_lastError!);
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> refreshOrders() async {
    final session = _session;
    if (session == null) return;
    try {
      final remote = await _orders_service.listOrders(session);
      final known = {for (final order in _orders) order.id: order};
      _orders
        ..clear()
        ..addAll(remote.map((draft) {
          final existing = known[draft.id];
          return Order(
            id: draft.id,
            orderNumber: draft.orderNumber,
            createdAt: existing?.createdAt ?? DateTime.now(),
            totalKes: draft.totalKes,
            paymentStatus: existing?.paymentStatus ?? 'pending',
            deliveryStatus: existing?.deliveryStatus ?? 'pending',
            items: existing?.items ?? 0,
            landmark: existing?.landmark ?? '',
            riderName: existing?.riderName ?? 'Assigned rider',
            riderPlate: existing?.riderPlate ?? 'Awaiting assignment',
          );
        }));
      notifyListeners();
    } on OrderException catch (error) {
      _lastError = error.message;
      notifyListeners();
    }
  }

  void markOrderPaid(String orderId, {String receipt = ''}) {
    final index = _orders.indexWhere((order) => order.id == orderId);
    if (index < 0) return;
    _orders[index] = _orders[index].copyWith(paymentStatus: 'paid');
    notifyListeners();
  }

  void updateOrderStatus(String orderId, String status) {
    final index = _orders.indexWhere((order) => order.id == orderId);
    if (index < 0) return;
    _orders[index] = _orders[index].copyWith(deliveryStatus: status);
    notifyListeners();
  }

  Future<void> sync() => _offline.flush();

  Future<void> _adopt(SupabaseSession session) async {
    _session = session;
    _authenticated = true;
    _api.setAuthToken(session.accessToken);
    try {
      if (_pendingName != null && _pendingName!.isNotEmpty) {
        await _auth.updateProfile(session, fullName: _pendingName);
      }
      final profile = await _auth.profile(session.accessToken);
      final role = '${profile['role'] ?? 'patient'}';
      if (role != 'patient') {
        throw SupabaseAuthException('This account is registered as a $role. Use the staff sign-in.');
      }
      if (profile['is_active'] == false) {
        throw SupabaseAuthException('This account has been deactivated. Contact support.');
      }
      _name = '${profile['full_name'] ?? ''}';
      _phone = '${profile['phone'] ?? _phone}';
      _consentGiven = profile['odpc_consent_given'] == true;
      _pendingName = null;
    } on SupabaseAuthException {
      _session = null;
      _authenticated = false;
      _api.setAuthToken(null);
      await _storage.clearSession();
      rethrow;
    }
  }

  SupabaseSession? get session => _session;

  SupabaseSession _requireSession() {
    final session = _session;
    if (session == null || session.isExpired) {
      throw const OrderException('Your session expired. Please sign in again.');
    }
    return session;
  }

  List<Product> _seedCatalog() {
    return const [
      Product(id: 'panadol-extra', name: 'Panadol Extra', genericName: 'Paracetamol', category: 'otc', priceKes: 80, stock: 42, requiresPrescription: false, swahiliName: 'Dawa ya maumivu'),
      Product(id: 'amox-500', name: 'Amoxil 500mg', genericName: 'Amoxicillin', category: 'prescription', priceKes: 450, stock: 18, requiresPrescription: true, swahiliName: 'Antibiotic'),
      Product(id: 'ors-sachet', name: 'ORS Sachet', genericName: 'Oral Rehydration Salts', category: 'otc', priceKes: 35, stock: 120, requiresPrescription: false, swahiliName: 'Chumvi za maji'),
      Product(id: 'digital-thermometer', name: 'Digital Thermometer', genericName: 'Clinical thermometer', category: 'device', priceKes: 950, stock: 9, requiresPrescription: false, swahiliName: 'Kipimaji joto'),
      Product(id: 'metformin', name: 'Metformin 500mg', genericName: 'Metformin', category: 'prescription', priceKes: 240, stock: 25, requiresPrescription: true, swahiliName: 'Dawa ya kisukari'),
      Product(id: 'vitamin-d', name: 'Vitamin D 1000IU', genericName: 'Cholecalciferol', category: 'supplement', priceKes: 450, stock: 65, requiresPrescription: false, swahiliName: 'Vitamin D'),
    ];
  }

  List<Prescription> _seedPrescriptions() {
    return [
      Prescription(
        id: 'rx-1',
        medication: 'Metformin 500mg',
        dosage: '1 tablet',
        frequency: 'Twice daily with meals',
        status: 'approved',
        createdAt: DateTime.now().subtract(const Duration(days: 18)),
        refillsRemaining: 2,
      ),
      Prescription(
        id: 'rx-2',
        medication: 'Amlodipine 5mg',
        dosage: '1 tablet',
        frequency: 'Once daily',
        status: 'dispensed',
        createdAt: DateTime.now().subtract(const Duration(days: 45)),
        refillsRemaining: 0,
      ),
    ];
  }

  List<Consultation> _seedConsultations() {
    return [
      Consultation(
        id: 'cons-1',
        provider: 'Dr. Wanjiku Mwangi',
        speciality: 'General practice',
        scheduledAt: DateTime.now().add(const Duration(days: 1, hours: 3)),
        type: 'video',
        status: 'scheduled',
        feeKes: 1500,
      ),
    ];
  }
}
