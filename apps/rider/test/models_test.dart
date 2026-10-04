import 'package:afyacommerce_rider/core/services/dispatch_api.dart';
import 'package:afyacommerce_rider/shared/models/delivery_job.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('delivery job carries the assigned order details', () {
    const job = DeliveryJob(
      id: '9f0a5f3e-2f5a-4d4d-9f3a-0d7b6a1c2e3f',
      orderNumber: 'AFY-2026-000201',
      status: 'dispatched',
      pickup: 'Equity Pharmacy, Westlands',
      dropoff: 'Near Sameer Business Centre',
      patientPhone: '+254712345678',
      feeKes: 220,
      distanceKm: 6.4,
      items: 2,
      expiresInSeconds: 45,
    );

    expect(job.orderNumber, 'AFY-2026-000201');
    expect(job.status, 'dispatched');
    expect(job.distanceKm, 6.4);
    expect(job.expiresInSeconds, 45);
    expect(job.dropoff, 'Near Sameer Business Centre');
  });

  test('server assigned jobs omit unknown fee, distance and item counts', () {
    const job = DeliveryJob(
      id: '9f0a5f3e-2f5a-4d4d-9f3a-0d7b6a1c2e3f',
      orderNumber: 'AFY-2026-000202',
      status: 'in_transit',
      pickup: 'Nairobi Central Pharmacy',
      dropoff: 'Kasarani',
      patientPhone: '+254712345678',
    );

    expect(job.feeKes, 0);
    expect(job.items, 0);
    expect(job.expiresInSeconds, 0);
  });

  test('assigned deliveries map the dispatch response and mark proof state', () {
    final delivery = AssignedDelivery.fromJson({
      'id': '9f0a5f3e-2f5a-4d4d-9f3a-0d7b6a1c2e3f',
      'order_number': 'AFY-2026-000201',
      'delivery_status': 'delivered',
      'delivery_address': {'landmark': 'Near Equity Bank', 'county': 'Nairobi', 'phone': '+254712345678'},
      'proof_of_delivery': {'photo_url': 'https://cdn.example.ke/proof.jpg'},
      'pharmacy': {'name': 'Nairobi Central Pharmacy', 'physical_address': ' Moi Avenue'},
    });

    expect(delivery.isActive, isFalse);
    expect(delivery.isDelivered, isTrue);
    expect(delivery.proofRecorded, isTrue);
    expect(delivery.dropoff, 'Near Equity Bank, Nairobi');
    expect(delivery.pickup, 'Nairobi Central Pharmacy • Moi Avenue');
  });

  test('an unproven in-transit delivery is still active', () {
    final delivery = AssignedDelivery.fromJson({
      'id': '9f0a5f3e-2f5a-4d4d-9f3a-0d7b6a1c2e3f',
      'order_number': 'AFY-2026-000201',
      'delivery_status': 'in_transit',
      'delivery_address': {'landmark': 'Kasarani', 'county': 'Nairobi'},
      'proof_of_delivery': null,
    });

    expect(delivery.isActive, isTrue);
    expect(delivery.isDelivered, isFalse);
    expect(delivery.proofRecorded, isFalse);
  });
}
