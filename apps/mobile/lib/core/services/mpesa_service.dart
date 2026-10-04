import '../network/api_client.dart';

class MpesaService {
  MpesaService({required ApiClient api}) : _api = api;

  final ApiClient _api;

  Future<MpesaResponse> initiateStkPush({
    required String phone,
    required int amount,
    required String orderId,
    required String orderNumber,
  }) async {
    final response = await _api.post(
      '/api/mpesa/stk-push',
      data: {
        'phone': phone,
        'amount': amount,
        'orderId': orderId,
        'orderNumber': orderNumber,
      },
    );
    if (response is! Map) throw const MpesaException('The payment service returned an unexpected response.');
    final parsed = MpesaResponse.fromJson(Map<String, dynamic>.from(response));
    if (parsed.checkoutRequestId.isEmpty) {
      throw MpesaException(
        parsed.customerMessage.isEmpty
            ? 'M-PESA did not return a payment prompt. Please try again.'
            : parsed.customerMessage,
      );
    }
    return parsed;
  }

  Stream<MpesaStatus> pollStatus(String checkoutRequestId) async* {
    final deadline = DateTime.now().add(const Duration(seconds: 90));
    var lastError = 'We could not confirm your payment.';
    while (DateTime.now().isBefore(deadline)) {
      MpesaStatus status;
      try {
        final response = await _api.get('/api/mpesa/status/$checkoutRequestId');
        if (response is! Map) throw const MpesaException('Unexpected payment status response.');
        status = MpesaStatus.fromJson(Map<String, dynamic>.from(response));
      } on MpesaException catch (error) {
        lastError = error.message;
        status = const MpesaStatus(status: 'pending');
      } catch (_) {
        status = const MpesaStatus(status: 'pending');
      }
      yield status;
      if (status.isTerminal) return;
      await Future<void>.delayed(const Duration(seconds: 3));
    }
    yield MpesaStatus(status: 'failed', timedOut: true, message: '$lastError Check your M-PESA history before retrying.');
  }
}

class MpesaResponse {
  const MpesaResponse({
    required this.checkoutRequestId,
    required this.merchantRequestId,
    required this.responseCode,
    required this.customerMessage,
  });

  final String checkoutRequestId;
  final String merchantRequestId;
  final String responseCode;
  final String customerMessage;

  factory MpesaResponse.fromJson(Map<String, dynamic> json) {
    return MpesaResponse(
      checkoutRequestId: '${json['CheckoutRequestID'] ?? ''}',
      merchantRequestId: '${json['MerchantRequestID'] ?? ''}',
      responseCode: '${json['ResponseCode'] ?? ''}',
      customerMessage: '${json['CustomerMessage'] ?? ''}',
    );
  }
}

class MpesaStatus {
  const MpesaStatus({required this.status, this.receipt, this.timedOut = false, this.message = ''});

  final String status;
  final String? receipt;
  final bool timedOut;
  final String message;

  bool get isTerminal => status == 'succeeded' || status == 'failed';

  factory MpesaStatus.fromJson(Map<String, dynamic> json) {
    return MpesaStatus(
      status: '${json['status'] ?? 'pending'}',
      receipt: (json['mpesa_receipt_number'] ?? json['mpesa_receipt'] ?? json['receipt'])?.toString(),
      message: (json['error'] ?? json['message'])?.toString() ?? '',
    );
  }
}

class MpesaException implements Exception {
  MpesaException(this.message);
  final String message;

  @override
  String toString() => message;
}
