import 'package:flutter/material.dart';
import '../../../shared/models/order.dart';
import '../../../shared/widgets/status_badge.dart';

class OrderStatusCard extends StatelessWidget {
  const OrderStatusCard({super.key, required this.order, this.onTap});

  final Order order;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Card(child: ListTile(onTap: onTap, title: Text(order.orderNumber, style: const TextStyle(fontWeight: FontWeight.w800)), subtitle: Text(order.landmark), trailing: StatusBadge(status: order.deliveryStatus)));
  }
}
