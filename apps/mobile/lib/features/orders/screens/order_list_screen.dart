import 'package:flutter/material.dart';
import '../../../shared/widgets/kes_price.dart';
import '../../../shared/widgets/status_badge.dart';
import '../../auth/providers/auth_provider.dart';
import 'delivery_tracking_screen.dart';

class OrderListScreen extends StatefulWidget {
  const OrderListScreen({super.key, required this.controller});

  final AuthProvider controller;

  @override
  State<OrderListScreen> createState() => _OrderListScreenState();
}

class _OrderListScreenState extends State<OrderListScreen> {
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    await widget.controller.refreshOrders();
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    return Scaffold(
      appBar: AppBar(title: const Text('My orders')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : controller.orders.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('Your orders will appear here.'),
                        if (controller.lastError != null) ...[
                          const SizedBox(height: 8),
                          Text(controller.lastError!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.red)),
                        ],
                        const SizedBox(height: 16),
                        OutlinedButton(onPressed: _load, child: const Text('Try again')),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
                    itemCount: controller.orders.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final order = controller.orders[index];
                      return Card(
                        child: InkWell(
                          borderRadius: BorderRadius.circular(16),
                          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => DeliveryTrackingScreen(order: order, controller: controller))),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(order.orderNumber, style: const TextStyle(fontWeight: FontWeight.w800)), StatusBadge(status: order.deliveryStatus)]),
                                const SizedBox(height: 14),
                                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text('${order.items} item${order.items == 1 ? '' : 's'}'), KesPrice(order.totalKes)]),
                                if (order.landmark.isNotEmpty) ...[
                                  const SizedBox(height: 8),
                                  Text('Delivery to ${order.landmark}', style: const TextStyle(color: Colors.black54)),
                                ],
                                const SizedBox(height: 12),
                                Row(mainAxisAlignment: MainAxisAlignment.end, children: [TextButton(onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => DeliveryTrackingScreen(order: order, controller: controller))), child: const Text('Track order')), const Icon(Icons.chevron_right)]),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
