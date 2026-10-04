import 'package:flutter/material.dart';
import '../../auth/providers/auth_provider.dart';
import '../../../shared/widgets/kes_price.dart';
import '../../../shared/widgets/status_badge.dart';
import 'booking_wizard_screen.dart';
import 'video_call_screen.dart';

class AppointmentListScreen extends StatelessWidget {
  const AppointmentListScreen({super.key, required this.controller});

  final AuthProvider controller;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Consultations')),
      body: controller.consultations.isEmpty
          ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [const Text('No consultations yet'), const SizedBox(height: 12), ElevatedButton(onPressed: () => _book(context), child: const Text('Book a consultation'))]))
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
              children: [
                ...controller.consultations.map((item) => Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: ListTile(
                        contentPadding: const EdgeInsets.all(16),
                        leading: const CircleAvatar(child: Icon(Icons.medical_services_outlined)),
                        title: Text(item.provider, style: const TextStyle(fontWeight: FontWeight.w800)),
                        subtitle: Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text('${item.speciality}\n${_formatDate(item.scheduledAt)} • ${item.type.toUpperCase()}'),
                        ),
                        trailing: StatusBadge(status: item.status),
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => VideoCallScreen(consultation: item))),
                      ),
                    )),
                const SizedBox(height: 8),
                OutlinedButton.icon(onPressed: () => _book(context), icon: const Icon(Icons.add), label: const Text('Book another consultation')),
              ],
            ),
      floatingActionButton: FloatingActionButton.extended(onPressed: () => _book(context), icon: const Icon(Icons.add), label: const Text('Book')),
    );
  }

  void _book(BuildContext context) {
    Navigator.push(context, MaterialPageRoute(builder: (_) => BookingWizardScreen(controller: controller)));
  }

  String _formatDate(DateTime value) {
    return '${value.day}/${value.month}/${value.year}, ${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';
  }
}
