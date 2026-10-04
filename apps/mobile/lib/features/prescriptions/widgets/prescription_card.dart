import 'package:flutter/material.dart';
import '../../../shared/models/prescription.dart';
import '../../../shared/widgets/status_badge.dart';

class PrescriptionCard extends StatelessWidget {
  const PrescriptionCard({super.key, required this.prescription, this.onTap});

  final Prescription prescription;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Card(child: ListTile(onTap: onTap, leading: const Icon(Icons.receipt_long_outlined), title: Text(prescription.medication, style: const TextStyle(fontWeight: FontWeight.w800)), subtitle: Text(prescription.frequency), trailing: StatusBadge(status: prescription.status)));
  }
}
