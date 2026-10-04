import 'package:flutter/material.dart';
import '../../../shared/models/order.dart';

class ConfirmationScreen extends StatelessWidget {
  const ConfirmationScreen({super.key, required this.order, required this.receipt});

  final Order order;
  final String receipt;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const CircleAvatar(radius: 40, backgroundColor: Colors.green, child: Icon(Icons.check, color: Colors.white, size: 48)),
                const SizedBox(height: 24),
                Text('Order confirmed', style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 8),
                const Text('Your payment was received and the pharmacy is preparing your order.'),
                const SizedBox(height: 24),
                Card(child: Padding(padding: const EdgeInsets.all(20), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('Order number', style: TextStyle(color: Colors.black54)), const SizedBox(height: 4), Text(order.orderNumber, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)), const Divider(height: 28), const Text('Delivery landmark', style: TextStyle(color: Colors.black54)), const SizedBox(height: 4), Text(order.landmark), if (receipt.isNotEmpty) ...[const Divider(height: 28), const Text('M-PESA receipt', style: TextStyle(color: Colors.black54)), const SizedBox(height: 4), Text(receipt)]]))),
                const SizedBox(height: 18),
                const Text('We will send delivery updates by SMS.', textAlign: TextAlign.center),
                const SizedBox(height: 28),
                ElevatedButton(onPressed: () => Navigator.popUntil((route) => route.isFirst), child: const Text('Back to home')),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
