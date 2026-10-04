import 'package:flutter/material.dart';
import '../../../shared/models/prescription.dart';
import '../../../shared/models/product.dart';
import '../../../shared/widgets/kes_price.dart';
import '../../../shared/widgets/trust_badges.dart';
import '../../auth/providers/auth_provider.dart';
import '../../prescriptions/screens/prescription_list_screen.dart';
import '../widgets/quick_actions.dart';
import '../widgets/upcoming_consultation.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key, required this.controller, required this.onNavigate});

  final AuthProvider controller;
  final ValueChanged<int> onNavigate;

  @override
  Widget build(BuildContext context) {
    final consultation = controller.consultations.isEmpty ? null : controller.consultations.first;
    return SafeArea(
      child: RefreshIndicator(
        onRefresh: controller.sync,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Hello, ${controller.name}', style: Theme.of(context).textTheme.headlineSmall),
                  const Text('How can we care for you today?', style: TextStyle(color: Colors.black54)),
                ]),
                IconButton(onPressed: () => _showNotifications(context), icon: const Icon(Icons.notifications_none), tooltip: 'Notifications'),
              ],
            ),
            const SizedBox(height: 22),
            QuickActions(controller: controller, onNavigate: onNavigate),
            const SizedBox(height: 16),
            if (consultation != null) UpcomingConsultation(consultation: consultation),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Shop medicines', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                TextButton(onPressed: () => onNavigate(2), child: const Text('View all')),
              ],
            ),
            SizedBox(
              height: 178,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: controller.catalog.length > 4 ? 4 : controller.catalog.length,
                separatorBuilder: (_, __) => const SizedBox(width: 12),
                itemBuilder: (context, index) {
                  final product = controller.catalog[index];
                  return _ProductPreview(product: product, onTap: () => onNavigate(2));
                },
              ),
            ),
            const SizedBox(height: 20),
            const Text('My prescriptions', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            if (controller.prescriptions.isEmpty)
              const Text('Your prescriptions will appear here.')
            else
              ...controller.prescriptions.take(2).map((prescription) => _PrescriptionPreview(
                    prescription: prescription,
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => PrescriptionListScreen(controller: controller))),
                  )),
            const SizedBox(height: 20),
            const Text('How can we help?', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            Card(
              child: ListTile(
                leading: const Icon(Icons.support_agent),
                title: const Text('Need help with an order?'),
                subtitle: const Text('Our team is available 7am–9pm EAT.'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _showHelp(context),
              ),
            ),
            const SizedBox(height: 16),
            const TrustBadges(),
            const SizedBox(height: 10),
            const Text('Licensed pharmacy services. Your health data stays in Kenya.', style: TextStyle(fontSize: 12, color: Colors.black54)),
          ],
        ),
      ),
    );
  }

  void _showNotifications(BuildContext context) {
    showModalBottomSheet<void>(context: context, builder: (context) => const Padding(padding: EdgeInsets.all(24), child: Text('You are all caught up.')));
  }

  void _showHelp(BuildContext context) {
    showModalBottomSheet<void>(context: context, builder: (context) => const Padding(padding: EdgeInsets.all(24), child: Text('Call 0700 000 000 or use the in-app chat during support hours.')));
  }
}

class _ProductPreview extends StatelessWidget {
  const _ProductPreview({required this.product, required this.onTap});
  final Product product;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 150,
      child: Card(
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(height: 54, decoration: BoxDecoration(color: Colors.blue.shade50, borderRadius: BorderRadius.circular(12)), child: const Icon(Icons.medication_outlined, size: 32)),
              const SizedBox(height: 8),
              Text(product.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
              const Spacer(),
              KesPrice(product.priceKes, style: const TextStyle(color: Colors.black87, fontSize: 13)),
            ]),
          ),
        ),
      ),
    );
  }
}

class _PrescriptionPreview extends StatelessWidget {
  const _PrescriptionPreview({required this.prescription, required this.onTap});
  final Prescription prescription;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: const Icon(Icons.receipt_long_outlined),
        title: Text(prescription.medication, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text('${prescription.dosage} • ${prescription.frequency}'),
        trailing: TextButton(onPressed: onTap, child: const Text('View')),
      ),
    );
  }
}
