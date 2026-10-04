import 'package:afyacommerce_mobile/core/config/env.dart';
import 'package:afyacommerce_mobile/core/services/mpesa_service.dart';
import 'package:afyacommerce_mobile/shared/models/order.dart';
import 'package:afyacommerce_mobile/shared/models/product.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('kenyan phone validation normalises local and international formats', () {
    expect(isValidKenyanPhone('0712345678'), isTrue);
    expect(isValidKenyanPhone('+254712345678'), isTrue);
    expect(isValidKenyanPhone('254712345678'), isTrue);
    expect(isValidKenyanPhone('12345'), isFalse);
    expect(isValidKenyanPhone(''), isFalse);
  });

  test('order copyWith only replaces the supplied fields', () {
    final order = Order(
      id: 'o-1',
      orderNumber: 'AFC-1001',
      createdAt: DateTime(2024, 1, 1),
      totalKes: 4500,
      paymentStatus: 'paid',
      deliveryStatus: 'preparing',
      items: 2,
      landmark: 'Near Equity Bank',
    );

    final delivered = order.copyWith(deliveryStatus: 'delivered');

    expect(delivered.deliveryStatus, 'delivered');
    expect(delivered.paymentStatus, 'paid');
    expect(delivered.orderNumber, 'AFC-1001');
    expect(delivered.totalKes, 4500);
  });

  test('product json round trip keeps identifiers and price', () {
    final product = Product.fromJson(const {
      'id': 'p-1',
      'name': 'Panadol 500mg',
      'generic_name': 'Paracetamol',
      'category': 'pain_relief',
      'price_kes': 120,
      'stock_quantity': 40,
      'requires_prescription': false,
    });

    expect(product.id, 'p-1');
    expect(product.name, 'Panadol 500mg');
    expect(product.genericName, 'Paracetamol');
    expect(product.priceKes, 120);
    expect(product.stock, 40);
    expect(product.requiresPrescription, isFalse);
  });

  test('mpesa status is terminal for succeeded and failed only', () {
    expect(const MpesaStatus(status: 'succeeded').isTerminal, isTrue);
    expect(const MpesaStatus(status: 'failed').isTerminal, isTrue);
    expect(const MpesaStatus(status: 'pending').isTerminal, isFalse);
  });
}
