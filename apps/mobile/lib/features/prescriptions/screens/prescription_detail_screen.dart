import 'package:flutter/material.dart';
import '../../../shared/models/prescription.dart';
import '../../../shared/widgets/status_badge.dart';
import '../../auth/providers/auth_provider.dart';

class PrescriptionDetailScreen extends StatelessWidget {
  const PrescriptionDetailScreen({super.key, required this.prescription, required this.controller});

  final Prescription prescription;
  final AuthProvider controller;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Prescription details')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        children: [
          Card(child: Padding(padding: const EdgeInsets.all(20), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [StatusBadge(status: prescription.status), const SizedBox(height: 14), Text(prescription.medication, style: Theme.of(context).textTheme.headlineSmall), const SizedBox(height: 8), Text('${prescription.dosage} • ${prescription.frequency}')]))),
          const SizedBox(height: 20),
          const Text('Prescription timeline', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          _Row(label: 'Issued', value: _date(prescription.createdAt)),
          _Row(label: 'Refills remaining', value: '${prescription.refillsRemaining}'),
          _Row(label: 'SHA claim', value: prescription.shaStatus.replaceAll('_', ' ')),
          const SizedBox(height: 18),
          Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(children: [const Icon(Icons.qr_code_2, size: 120), const SizedBox(height: 8), const Text('Show this code at a participating pharmacy'), const SizedBox(height: 8), OutlinedButton.icon(onPressed: () {}, icon: const Icon(Icons.download_outlined), label: const Text('Save prescription'))]))),
          const SizedBox(height: 18),
          ElevatedButton.icon(onPressed: prescription.refillsRemaining > 0 ? () => _requestRefill(context) : null, icon: const Icon(Icons.refresh), label: const Text('Request refill')),
        ],
      ),
    );
  }

  void _requestRefill(BuildContext context) {
    showDialog<void>(context: context, builder: (context) => AlertDialog(title: const Text('Refill request sent'), content: const Text('The pharmacy will confirm availability by SMS.'), actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Done'))]));
  }

  String _date(DateTime date) => '${date.day}/${date.month}/${date.year}';
}
