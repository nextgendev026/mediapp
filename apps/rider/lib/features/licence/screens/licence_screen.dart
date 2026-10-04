import 'package:flutter/material.dart';
import '../../../app.dart';

class LicenceScreen extends StatelessWidget {
  const LicenceScreen({super.key, required this.controller});

  final RiderController controller;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Transport licence')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.verified_user, size: 54, color: Colors.green),
                  const SizedBox(height: 16),
                  const Text('Licence on record', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 14),
                  Text('Licence number: ${controller.licenceNumber.isEmpty ? 'Not on record' : controller.licenceNumber}'),
                  const SizedBox(height: 8),
                  Text('Expiry date: ${controller.licenceExpiry.isEmpty ? 'Not on record' : controller.licenceExpiry}'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 18),
          const Text('A valid Pharmacy and Poisons transportation licence is required to carry pharmaceutical deliveries. Licences are verified against the regulator register before a rider can go online.'),
          const SizedBox(height: 18),
          const Text('To renew or correct your licence details, contact the AfyaCommerce dispatch desk. Licence changes are made by an administrator after verifying the regulator record.'),
        ],
      ),
    );
  }
}
