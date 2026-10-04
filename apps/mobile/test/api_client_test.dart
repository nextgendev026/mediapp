import 'package:afyacommerce_mobile/core/network/api_client.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  final gatewayKeyPattern = RegExp(r'^[A-Za-z0-9._:-]{8,128}$');

  test('post sends an idempotency key accepted by the edge gateway', () async {
    http.Request? captured;
    final api = ApiClient(
      baseUrl: 'https://api.afyacommerce.co.ke',
      client: MockClient((request) async {
        captured = request;
        return http.Response('{"CheckoutRequestID":"cs-1"}', 200);
      }),
    );

    await api.post('/api/mpesa/stk-push', data: {'phone': '+254712345678', 'amount': 4500});

    final key = captured!.headers['Idempotency-Key'];
    expect(key, isNotNull);
    expect(gatewayKeyPattern.hasMatch(key!), isTrue);
  });

  test('post keeps a caller supplied idempotency key for safe retries', () async {
    http.Request? captured;
    final api = ApiClient(
      baseUrl: 'https://api.afyacommerce.co.ke',
      client: MockClient((request) async {
        captured = request;
        return http.Response('{}', 200);
      }),
    );

    await api.post('/api/checkout/orders', data: const {'items': []}, headers: {'Idempotency-Key': 'idem.replay.1'});

    expect(captured!.headers['Idempotency-Key'], 'idem.replay.1');
  });

  test('authorization header is only present once a token is set', () async {
    http.Request? captured;
    final api = ApiClient(
      baseUrl: 'https://api.afyacommerce.co.ke',
      client: MockClient((request) async {
        captured = request;
        return http.Response('{}', 200);
      }),
    );

    await api.get('/api/catalog/products');
    expect(captured!.headers.containsKey('Authorization'), isFalse);

    api.setAuthToken('session-token');
    await api.get('/api/catalog/products');
    expect(captured!.headers['Authorization'], 'Bearer session-token');
  });

  test('trailing slash in the base url does not double up on paths', () async {
    http.Request? captured;
    final api = ApiClient(
      baseUrl: 'https://api.afyacommerce.co.ke/',
      client: MockClient((request) async {
        captured = request;
        return http.Response('{}', 200);
      }),
    );

    await api.get('/api/catalog/products');

    expect(captured!.url.toString(), 'https://api.afyacommerce.co.ke/api/catalog/products');
  });

  test('non json error bodies still surface the status code', () async {
    final api = ApiClient(
      baseUrl: 'https://api.afyacommerce.co.ke',
      client: MockClient((request) async => http.Response('<html>bad gateway</html>', 502)),
    );

    expect(
      () => api.get('/api/mpesa/status/cs-1'),
      throwsA(isA<ApiException>().having((error) => error.statusCode, 'statusCode', 502)),
    );
  });
}
