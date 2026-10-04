import 'package:flutter/material.dart';
import '../../../core/services/sms_service.dart';
import '../../../shared/models/order.dart';
import '../../../shared/widgets/status_badge.dart';
import '../../auth/providers/auth_provider.dart';

class DeliveryTrackingScreen extends StatelessWidget {
  const DeliveryTrackingScreen({super.key, required this.order, required this.controller});

  final Order order;
  final AuthProvider controller;

  static const _stages = <String>['confirmed', 'dispatched', 'in_transit', 'delivered'];

  @override
  Widget build(BuildContext context) {
    final current = _stages.indexOf(order.deliveryStatus);
    final failed = order.deliveryStatus == 'failed' || order.deliveryStatus == 'cancelled';
    return Scaffold(
      appBar: AppBar(title: const Text('Track delivery')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(order.orderNumber, style: const TextStyle(fontWeight: FontWeight.w800)),
                  StatusBadge(status: order.deliveryStatus),
                ],
              ),
            ),
          ),
          const SizedBox(height: 22),
          const Text('Delivery progress', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          ...List.generate(_stages.length, (index) {
            return _TimelineItem(
              index: index,
              title: _stageTitle(index),
              subtitle: failed ? 'Delivery stopped' : (index <= current ? 'Completed' : 'Pending'),
              completed: !failed && index <= current,
              last: index == _stages.length - 1,
            );
          }),
          if (failed) ...[
            const SizedBox(height: 8),
            const Text(
              'This delivery could not be completed. Support will contact you to arrange a new attempt.',
              style: TextStyle(color: Colors.red),
            ),
          ],
          const SizedBox(height: 18),
          OutlinedButton.icon(
            onPressed: controller.refreshOrders,
            icon: const Icon(Icons.refresh),
            label: const Text('Refresh status'),
          ),
        ],
      ),
    );
  }

  String _stageTitle(int index) {
    return const ['Order confirmed', 'Rider dispatched', 'On the way', 'Delivered'][index];
  }
}

class _TimelineItem extends StatelessWidget {
  const _TimelineItem({required this.index, required this.title, required this.subtitle, required this.completed, required this.last});

  final int index;
  final String title;
  final String subtitle;
  final bool completed;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              CircleAvatar(
                radius: 14,
                backgroundColor: completed ? Colors.green : Colors.white,
                child: completed
                    ? const Icon(Icons.check, color: Colors.white, size: 16)
                    : Text('${index + 1}', style: const TextStyle(fontSize: 12)),
              ),
              if (!last)
                Expanded(
                  child: Container(width: 2, color: completed ? Colors.green : Colors.black12),
                ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: TextStyle(fontWeight: completed ? FontWeight.w800 : FontWeight.w500)),
                  const SizedBox(height: 3),
                  Text(subtitle, style: const TextStyle(color: Colors.black54, fontSize: 12)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
