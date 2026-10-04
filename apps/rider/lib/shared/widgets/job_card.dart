import 'package:flutter/material.dart';
import '../models/delivery_job.dart';

class JobCard extends StatelessWidget {
  const JobCard({super.key, required this.job, required this.onAccept, required this.onDecline, this.acceptEnabled = true, this.acceptLabel = 'Accept job'});

  final DeliveryJob job;
  final VoidCallback onAccept;
  final VoidCallback onDecline;
  final bool acceptEnabled;
  final String acceptLabel;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(job.orderNumber, style: const TextStyle(fontWeight: FontWeight.w800)), if (job.expiresInSeconds > 0) Chip(label: Text('${job.expiresInSeconds}s'))]),
          const SizedBox(height: 12),
          _Place(icon: Icons.storefront_outlined, title: 'Pickup', value: job.pickup),
          const SizedBox(height: 10),
          _Place(icon: Icons.location_on_outlined, title: 'Drop-off', value: job.dropoff),
          const SizedBox(height: 14),
          ...[
            if (job.distanceKm > 0) '${job.distanceKm.toStringAsFixed(1)} km',
            if (job.items > 0) '${job.items} item${job.items == 1 ? '' : 's'}',
          ].map((detail) => Text(detail, style: const TextStyle(color: Colors.black54))),
          if (job.distanceKm > 0 || job.items > 0 || job.feeKes > 0) ...[
            if (job.feeKes > 0) Text('KES ${job.feeKes}', style: const TextStyle(fontWeight: FontWeight.w800, color: Colors.green)),
          ],
          const SizedBox(height: 16),
          Row(children: [Expanded(child: OutlinedButton(onPressed: onDecline, child: const Text('Decline'))), const SizedBox(width: 10), Expanded(child: ElevatedButton(onPressed: acceptEnabled ? onAccept : null, child: Text(acceptLabel)))]),
        ]),
      ),
    );
  }
}

class _Place extends StatelessWidget {
  const _Place({required this.icon, required this.title, required this.value});
  final IconData icon;
  final String title;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Icon(icon, size: 20, color: Colors.green), const SizedBox(width: 10), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(fontSize: 12, color: Colors.black54)), const SizedBox(height: 2), Text(value, style: const TextStyle(fontWeight: FontWeight.w700))]))]);
  }
}
