import 'package:flutter/material.dart';
import '../../../app.dart';

class EarningsScreen extends StatelessWidget {
  const EarningsScreen({super.key, required this.controller});

  final RiderController controller;

  @override
  Widget build(BuildContext context) {
    final delivered = controller.deliveries.where((delivery) => delivery.isDelivered).toList();
    return Scaffold(
      appBar: AppBar(title: const Text('Earnings')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Completed deliveries', style: TextStyle(color: Colors.black54)),
                  const SizedBox(height: 6),
                  Text('${controller.completedTrips}', style: Theme.of(context).textTheme.headlineSmall),
                  const SizedBox(height: 14),
                  const Text(
                    'Rider payouts are settled weekly to the M-PESA number on your verified account. Contact the dispatch desk to change your payout number.',
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 18),
          const Text('Trip history', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          if (delivered.isEmpty)
            const Card(child: Padding(padding: EdgeInsets.all(18), child: Text('No completed deliveries yet.')))
          else
            ...delivered.map(
              (delivery) => Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  leading: const Icon(Icons.local_shipping_outlined),
                  title: Text(delivery.orderNumber),
                  subtitle: Text(delivery.proofRecorded ? 'Delivered • proof recorded' : 'Delivered'),
                  trailing: const Icon(Icons.verified, color: Colors.green),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
