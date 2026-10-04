import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'core/network/api_client.dart';
import 'core/network/supabase_auth.dart';
import 'core/services/dispatch_api.dart';
import 'core/services/location_service.dart';
import 'core/services/notification_service.dart';
import 'core/services/ussd_service.dart';
import 'core/storage/secure_storage_service.dart';
import 'features/auth/screens/login_screen.dart';
import 'features/availability/screens/availability_screen.dart';
import 'shared/models/delivery_job.dart';

class RiderApp extends StatelessWidget {
  const RiderApp({super.key, required this.controller});

  final RiderController controller;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'AfyaCommerce Rider',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF1DA84A)),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFF9FAFB),
      ),
      home: RiderRoot(controller: controller),
    );
  }
}

class RiderRoot extends StatelessWidget {
  const RiderRoot({super.key, required this.controller});

  final RiderController controller;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        if (!controller.restored) return const Scaffold(body: Center(child: CircularProgressIndicator()));
        if (!controller.authenticated) return LoginScreen(controller: controller);
        return AvailabilityScreen(controller: controller);
      },
    );
  }
}

class RiderController extends ChangeNotifier {
  RiderController({
    required SecureStorageService storage,
    required ApiClient api,
    required NotificationService notifications,
  })  : _storage = storage,
        _api = api,
        _auth = SupabaseAuthService(),
        dispatch = DispatchApi(api: api),
        _notifications = notifications;

  final SecureStorageService _storage;
  final ApiClient _api;
  final SupabaseAuthService _auth;
  final NotificationService _notifications;
  final DispatchApi dispatch;
  final LocationService location = LocationService();

  static const _sessionKey = 'rider_session';

  bool restored = false;
  bool authenticated = false;
  bool busy = false;
  bool available = false;
  String? error;
  String county = 'Nairobi';
  String? riderId;
  String name = '';
  String licenceNumber = '';
  String licenceExpiry = '';
  String? phone;
  int completedTrips = 0;
  String deliveryStatus = 'idle';
  DeliveryJob? currentJob;
  AssignedDelivery? assigned;
  List<AssignedDelivery> deliveries = const [];

  SupabaseSession? _session;
  String _pendingPhone = '';

  bool get hasActiveJob => assigned != null && assigned!.isActive;

  Future<void> restoreSession() async {
    await _notifications.initialize();
    final session = SupabaseSession.fromJson(await _storage.readSession());
    if (session != null) {
      try {
        final active = session.isExpired ? await _auth.refresh(session) : session;
        await _adopt(active);
      } catch (_) {
        await _storage.clearSession();
      }
    }
    restored = true;
    notifyListeners();
  }

  Future<bool> requestOtp(String phoneInput) async {
    error = null;
    final normalized = normalizeKenyanPhone(phoneInput);
    if (normalized == null) {
      error = 'Enter a valid Kenyan phone number.';
      notifyListeners();
      return false;
    }
    busy = true;
    notifyListeners();
    try {
      await _auth.requestOtp(normalized);
      _pendingPhone = normalized;
      return true;
    } catch (failure) {
      error = failure is SupabaseAuthException ? failure.message : 'We could not send the code.';
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<bool> confirmOtp(String token) async {
    if (_pendingPhone.isEmpty) {
      error = 'Request a code first.';
      notifyListeners();
      return false;
    }
    if (!RegExp(r'^\d{6}$').hasMatch(token)) {
      error = 'Enter the 6-digit code from your SMS.';
      notifyListeners();
      return false;
    }
    error = null;
    busy = true;
    notifyListeners();
    try {
      final session = await _auth.verifyOtp(phone: _pendingPhone, token: token);
      await _adopt(session);
      return true;
    } on SupabaseAuthException catch (failure) {
      error = failure.message;
      return false;
    } catch (_) {
      error = 'That code is invalid or expired.';
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> _adopt(SupabaseSession session) async {
    final profile = await _auth.profile(session.accessToken);
    final role = '${profile['role'] ?? ''}';
    final isActive = profile['is_active'] == true;
    final rider = profile['riders'];
    if (role != 'rider' || !isActive || rider is! Map) {
      await _storage.clearSession();
      _api.setAuthToken(null);
      throw const SupabaseAuthException('This account is not approved to deliver medicines.');
    }
    _session = session;
    _api.setAuthToken(session.accessToken);
    await _storage.saveSession(session.toJson());
    authenticated = true;
    riderId = '${profile['id'] ?? ''}';
    name = '${profile['full_name'] ?? ''}';
    licenceNumber = '${rider['transport_licence_number'] ?? ''}';
    licenceExpiry = '${rider['transport_licence_expiry'] ?? ''}';
    county = '${rider['county'] ?? county}';
    available = rider['is_available'] == true;
    await refreshDeliveries();
    notifyListeners();
  }

  Future<void> refreshDeliveries() async {
    try {
      deliveries = await dispatch.listDeliveries();
      AssignedDelivery? active;
      for (final delivery in deliveries) {
        if (delivery.isActive) {
          active = delivery;
          break;
        }
      }
      assigned = active;
      currentJob = active == null
          ? null
          : DeliveryJob(
              id: active.id,
              orderNumber: active.orderNumber,
              status: active.status,
              pickup: active.pickup,
              dropoff: active.dropoff.isEmpty ? 'Delivery landmark pending' : active.dropoff,
              patientPhone: active.patientPhone,
            );
      deliveryStatus = active?.status ?? (deliveries.any((item) => item.isDelivered) ? 'delivered' : 'idle');
      completedTrips = deliveries.where((item) => item.isDelivered).length;
    } catch (failure) {
      error = failure is ApiException ? failure.message : 'We could not load your deliveries.';
    }
    notifyListeners();
  }

  Future<void> logout() async {
    final session = _session;
    _session = null;
    authenticated = false;
    available = false;
    riderId = null;
    assigned = null;
    currentJob = null;
    deliveries = const [];
    _api.setAuthToken(null);
    await _storage.clearSession();
    if (session != null) await _auth.signOut(session);
    notifyListeners();
  }

  Future<void> setAvailable(bool value) async {
    if (!authenticated) return;
    available = value;
    error = null;
    notifyListeners();
    final point = await location.getCurrentPosition();
    try {
      await dispatch.setAvailability(
        available: value,
        lat: point?.latitude,
        lng: point?.longitude,
      );
    } catch (failure) {
      available = !value;
      error = failure is ApiException ? failure.message : 'We could not update your availability.';
      notifyListeners();
    }
  }

  Future<bool> acceptJob() async {
    final job = assigned;
    if (job == null) return false;
    error = null;
    busy = true;
    notifyListeners();
    try {
      await dispatch.accept(job.id);
      await refreshDeliveries();
      return true;
    } catch (failure) {
      error = failure is ApiException ? failure.message : 'We could not accept this delivery.';
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<bool> submitProof({required String photoUrl, required String otp, required double lat, required double lng}) async {
    final job = assigned;
    if (job == null) return false;
    error = null;
    busy = true;
    notifyListeners();
    try {
      await dispatch.submitProof(orderId: job.id, photoUrl: photoUrl, otp: otp, lat: lat, lng: lng);
      await refreshDeliveries();
      return true;
    } catch (failure) {
      error = failure is ApiException ? failure.message : 'We could not record the delivery proof.';
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> openSms(String patientPhone) async {
    if (patientPhone.isEmpty) return;
    await UssdService.sendSms(phone: patientPhone, body: 'Hello, I am your AfyaCommerce rider. I am arriving shortly.');
  }
}

String? normalizeKenyanPhone(String input) {
  final digits = input.replaceAll(RegExp(r'[^0-9]'), '');
  if (digits.startsWith('254') && digits.length == 12) return '+$digits';
  if (digits.length == 9 && (digits.startsWith('7') || digits.startsWith('1'))) return '+254$digits';
  if (digits.length == 10 && digits.startsWith('0')) return '+254${digits.substring(1)}';
  return null;
}
