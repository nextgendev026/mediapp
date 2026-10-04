import 'package:flutter/material.dart';
import '../../../app.dart';
import 'proof_of_delivery_screen.dart';

class ActiveDeliveryScreen extends StatelessWidget {
  const ActiveDeliveryScreen({super.key, required this.controller});

  final RiderController controller;

  @override
  Widget build(BuildContext context) {
    final job = controller.assigned;
    if (job == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Active delivery')),
        body: const Center(child: Text('No active delivery. Pull to refresh your offers.')),
      );
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Active delivery')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(job.orderNumber, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 6),
                  Text('Status: ${job.status}', style: const TextStyle(color: Colors.black54)),
                  const SizedBox(height: 14),
                  _RouteLine(icon: Icons.storefront_outlined, title: 'Pickup pharmacy', value: job.pickup),
                  const SizedBox(height: 14),
                  _RouteLine(icon: Icons.location_on_outlined, title: 'Drop-off landmark', value: job.dropoff),
                ],
              ),
            ),
          ),
          if (controller.error != null) ...[
            const SizedBox(height: 12),
            Text(controller.error!, style: const TextStyle(color: Colors.red)),
          ],
          const SizedBox(height: 18),
          _Timeline(status: job.status),
          const SizedBox(height: 22),
          ElevatedButton.icon(
            onPressed: controller.busy || job.proofRecorded || job.status != 'in_transit'
                ? null
                : () => Navigator.push(context, MaterialPageRoute(builder: (_) => ProofOfDeliveryScreen(controller: controller))),
            icon: const Icon(Icons.photo_camera_outlined),
            label: Text(job.proofRecorded
                ? 'Proof recorded'
                : job.status == 'in_transit'
                    ? 'Proof of delivery'
                    : 'Accept the job to record proof'),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: job.patientPhone.isEmpty ? null : () => controller.openSms(job.patientPhone),
            icon: const Icon(Icons.sms_outlined),
            label: const Text('Message patient'),
          ),
        ],
      ),
    );
  }
}

class _RouteLine extends StatelessWidget {
  const _RouteLine({required this.icon, required this.title, required this.value});

  final IconData icon;
  final String title;
  final String value;

  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: Colors.green),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: Colors.black54, fontSize: 12)),
                const SizedBox(height: 3),
                Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
              ],
            ),
          ),
        ],
      );
}

class _Timeline extends StatelessWidget {
  const _Timeline({required this.status});

  final String status;

  static const _steps = <String, String>{
    'dispatched': 'Assigned',
    'in_transit': 'Picked up',
    'delivered': 'Delivered',
  };

  @override
  Widget build(BuildContext context) {
    final reached = switch (status) {
      'dispatched' => 1,
      'in_transit' => 2,
      'delivered' => 3,
      _ => 1,
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Chain of custody', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 12),
        ..._steps.entries.toList().asMap().entries.map((entry) {
          final done = entry.key < reached;
          return ListTile(
            leading: CircleAvatar(
              radius: 13,
              backgroundColor: done ? Colors.green : Colors.white,
              child: Text('${entry.key + 1}', style: TextStyle(color: done ? Colors.white : Colors.black)),
            ),
            title: Text(entry.value.value),
            dense: true,
          );
        }),
      ],
    );
  }
}