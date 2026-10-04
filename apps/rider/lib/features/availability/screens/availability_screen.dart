import 'package:flutter/material.dart';
import '../../../app.dart';
import '../../delivery/screens/active_delivery_screen.dart';
import '../../dispatch/screens/job_offer_screen.dart';
import '../../earnings/screens/earnings_screen.dart';
import '../../licence/screens/licence_screen.dart';

class AvailabilityScreen extends StatelessWidget {
  const AvailabilityScreen({super.key, required this.controller});

  final RiderController controller;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Availability'),
        actions: [IconButton(onPressed: controller.logout, icon: const Icon(Icons.logout))],
      ),
      body: RefreshIndicator(
        onRefresh: controller.refreshDeliveries,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
          children: [
            Card(
              child: SwitchListTile(
                value: controller.available,
                onChanged: controller.setAvailable,
                title: Text(controller.available ? 'You are online' : 'You are offline', style: const TextStyle(fontWeight: FontWeight.w800)),
                subtitle: Text(controller.available ? 'Job offers will appear here' : 'Go online to receive nearby jobs'),
                secondary: Icon(controller.available ? Icons.wifi : Icons.wifi_off, color: controller.available ? Colors.green : Colors.black54),
              ),
            ),
            if (controller.error != null) ...[
              const SizedBox(height: 12),
              Text(controller.error!, style: const TextStyle(color: Colors.red)),
            ],
            const SizedBox(height: 18),
            const Text('Operating county', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            Text('County is set from your verified rider record: ${controller.county}'),
            const SizedBox(height: 20),
            Card(
              child: ListTile(
                leading: const Icon(Icons.directions_car_outlined),
                title: const Text('Transport licence'),
                subtitle: Text('${controller.licenceNumber} • expires ${controller.licenceExpiry}'),
                trailing: const Icon(Icons.verified, color: Colors.green),
              ),
            ),
            const SizedBox(height: 20),
            if (controller.hasActiveJob)
              Card(
                child: ListTile(
                  leading: const Icon(Icons.local_shipping_outlined, color: Colors.green),
                  title: Text('Active delivery ${controller.assigned?.orderNumber ?? ''}'),
                  subtitle: const Text('Tap to open the delivery and record proof of handover.'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ActiveDeliveryScreen(controller: controller))),
                ),
              )
            else
              ElevatedButton.icon(
                onPressed: controller.available
                    ? () async {
                        await controller.refreshDeliveries();
                        if (!context.mounted) return;
                        await Navigator.push(context, MaterialPageRoute(builder: (_) => JobOfferScreen(controller: controller)));
                      }
                    : null,
                icon: const Icon(Icons.local_shipping_outlined),
                label: const Text('Check for job offers'),
              ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => EarningsScreen(controller: controller))),
                    icon: const Icon(Icons.payments_outlined),
                    label: const Text('Earnings'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => LicenceScreen(controller: controller))),
                    icon: const Icon(Icons.verified_user_outlined),
                    label: const Text('Licence'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            const TrustBadges(),
          ],
        ),
      ),
    );
  }
}

class TrustBadges extends StatelessWidget {
  const TrustBadges({super.key});

  @override
  Widget build(BuildContext context) {
    return const Wrap(
      spacing: 12,
      children: [
        Chip(avatar: Icon(Icons.verified_user_outlined, size: 16), label: Text('Transport licence verified')),
        Chip(avatar: Icon(Icons.shield_outlined, size: 16), label: Text('Chain of custody')),
      ],
    );
  }
}
