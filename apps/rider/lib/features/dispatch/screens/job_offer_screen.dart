import 'package:flutter/material.dart';
import '../../../app.dart';
import '../../delivery/screens/active_delivery_screen.dart';
import '../../../shared/widgets/job_card.dart';

class JobOfferScreen extends StatelessWidget {
  const JobOfferScreen({super.key, required this.controller});

  final RiderController controller;

  @override
  Widget build(BuildContext context) {
    final job = controller.currentJob;
    if (job == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Job offer')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text('No delivery is currently assigned to you. Go online and dispatch will assign nearby orders.'),
          ),
        ),
      );
    }
    final alreadyPickedUp = job.status != 'dispatched';
    return Scaffold(
      appBar: AppBar(title: const Text('Job offer')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        children: [
          Text(
            alreadyPickedUp
                ? 'You have already started this delivery. Record proof of handover to complete it.'
                : 'Dispatch assigned this order to you. Accepting moves it to in transit.',
            style: const TextStyle(color: Colors.black54),
          ),
          const SizedBox(height: 16),
          JobCard(
            job: job,
            acceptEnabled: !alreadyPickedUp && !controller.busy,
            acceptLabel: alreadyPickedUp ? 'Already picked up' : 'Accept job',
            onAccept: () => _accept(context),
            onDecline: () => Navigator.pop(context),
          ),
          if (controller.error != null) ...[
            const SizedBox(height: 12),
            Text(controller.error!, style: const TextStyle(color: Colors.red)),
          ],
        ],
      ),
    );
  }

  Future<void> _accept(BuildContext context) async {
    final accepted = await controller.acceptJob();
    if (!context.mounted) return;
    if (!accepted) return;
    await Navigator.push(context, MaterialPageRoute(builder: (_) => ActiveDeliveryScreen(controller: controller)));
  }
}
