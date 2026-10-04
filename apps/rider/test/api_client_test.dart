import 'package:afyacommerce_rider/core/network/api_client.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  test('rider availability posts to the dispatch prefix with an idempotency key', () async {
    http.Request? captured;
    final api = ApiClient(
      baseUrl: 'https://api.afyacommerce.co.ke',
      client: MockClient((request) async {
        captured = request;
        return http.Response('{"ok":true}', 200);
      }),
    )..setAuthToken('rider-token');

    await api.post('/dispatch/availability', data: {'isAvailable': true});

    expect(captured!.url.path, '/dispatch/availability');
    expect(captured!.method, 'POST');
    expect(RegExp(r'^[A-Za-z0-9._:-]{8,128}$').hasMatch(captured!.headers['Idempotency-Key']!), isTrue);
    expect(captured!.headers['Authorization'], 'Bearer rider-token');
  });

  test('requests are rejected before a session token is set', () async {
    var called = false;
    final api = ApiClient(
      baseUrl: 'https://api.afyacommerce.co.ke',
      client: MockClient((request) async {
        called = true;
        return http.Response('{}', 200);
      }),
    );

    await expectLater(
      api.get('/dispatch/orders'),
      throwsA(isA<ApiException>().having((error) => error.statusCode, 'statusCode', 401)),
    );
    expect(called, isFalse);
  });

  test('clearing the token removes the authorization header', () async {
    http.Request? captured;
    final api = ApiClient(
      baseUrl: 'https://api.afyacommerce.co.ke',
      client: MockClient((request) async {
        captured = request;
        return http.Response('{}', 200);
      }),
    )..setAuthToken('rider-token');

    await api.get('/dispatch/orders');
    expect(captured!.headers['Authorization'], 'Bearer rider-token');

    api.setAuthToken(null);
    await expectLater(api.get('/dispatch/orders'), throwsA(isA<ApiException>()));
  });

  test('non json error bodies still surface the status code', () async {
    final api = ApiClient(
      baseUrl: 'https://api.afyacommerce.co.ke',
      client: MockClient((request) async => http.Response('upstream unavailable', 503)),
    )..setAuthToken('rider-token');

    expect(
      () => api.post('/dispatch/availability', data: const {}),
      throwsA(isA<ApiException>().having((error) => error.statusCode, 'statusCode', 503)),
    );
  });
}
