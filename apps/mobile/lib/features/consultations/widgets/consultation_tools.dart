import 'package:flutter/material.dart';

class ConsultationTools extends StatelessWidget {
  const ConsultationTools({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(children: [Expanded(child: OutlinedButton.icon(onPressed: () {}, icon: const Icon(Icons.notes), label: const Text('Notes'))), const SizedBox(width: 8), Expanded(child: OutlinedButton.icon(onPressed: () {}, icon: const Icon(Icons.description_outlined), label: const Text('Prescription')))]);
  }
}
