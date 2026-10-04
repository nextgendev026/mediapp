import 'package:flutter/material.dart';
import '../../../shared/widgets/status_badge.dart';
import '../../auth/providers/auth_provider.dart';
import 'prescription_detail_screen.dart';
import 'upload_prescription_screen.dart';

class PrescriptionListScreen extends StatelessWidget {
  const PrescriptionListScreen({super.key, required this.controller});

  final AuthProvider controller;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Prescriptions'), actions: [IconButton(onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => UploadPrescriptionScreen(controller: controller))), icon: const Icon(Icons.add_a_photo_outlined), tooltip: 'Upload prescription')]),
      body: controller.prescriptions.isEmpty
          ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.description_outlined, size: 64, color: Colors.black38), const SizedBox(height: 16), const Text('No prescriptions uploaded yet.'), const SizedBox(height: 16), ElevatedButton(onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => UploadPrescriptionScreen(controller: controller))), child: const Text('Upload prescription'))]))
          : ListView.separated(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
              itemCount: controller.prescriptions.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final prescription = controller.prescriptions[index];
                return Card(child: ListTile(contentPadding: const EdgeInsets.all(16), leading: const CircleAvatar(child: Icon(Icons.receipt_long_outlined)), title: Text(prescription.medication, style: const TextStyle(fontWeight: FontWeight.w800)), subtitle: Padding(padding: const EdgeInsets.only(top: 6), child: Text('${prescription.dosage} • ${prescription.frequency}')), trailing: StatusBadge(status: prescription.status), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => PrescriptionDetailScreen(prescription: prescription, controller: controller)))));
              },
            ),
    );
  }
}
