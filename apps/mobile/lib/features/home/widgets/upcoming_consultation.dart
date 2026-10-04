import 'package:flutter/material.dart';
import '../../../shared/models/consultation.dart';
import '../../../shared/widgets/status_badge.dart';
import '../../consultations/screens/video_call_screen.dart';

class UpcomingConsultation extends StatelessWidget {
  const UpcomingConsultation({super.key, required this.consultation});

  final Consultation consultation;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Upcoming consultation', style: TextStyle(fontWeight: FontWeight.w800)),
                StatusBadge(status: consultation.status),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                const CircleAvatar(child: Icon(Icons.person)),
                const SizedBox(width: 12),
                Expanded(child: Text('${consultation.provider}\n${consultation.speciality}', style: const TextStyle(fontWeight: FontWeight.w600))),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(_dateLabel(consultation.scheduledAt), style: const TextStyle(color: Colors.black54)),
                OutlinedButton.icon(
                  onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => VideoCallScreen(consultation: consultation))),
                  icon: const Icon(Icons.videocam_outlined),
                  label: const Text('Join'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _dateLabel(DateTime date) {
    final hour = date.hour.toString().padLeft(2, '0');
    final minute = date.minute.toString().padLeft(2, '0');
    return '${date.day}/${date.month}/${date.year} at $hour:$minute';
  }
}
