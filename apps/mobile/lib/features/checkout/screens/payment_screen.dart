import 'package:flutter/material.dart';
import '../../auth/providers/auth_provider.dart';
import '../../../core/services/mpesa_service.dart';
import '../../../shared/models/order.dart';
import '../../../shared/widgets/kes_price.dart';
import '../widgets/mpesa_sheet.dart';
import 'confirmation_screen.dart';

class PaymentScreen extends StatefulWidget {
  const PaymentScreen({super.key, required this.controller, required this.order});

  final AuthProvider controller;
  final Order order;

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  final _phone = TextEditingController();
  String _method = 'mpesa';
  bool _busy = false;
  String? _message;

  @override
  void initState() {
    super.initState();
    _phone.text = widget.controller.phone;
  }

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Payment')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        children: [
          Card(child: Padding(padding: const EdgeInsets.all(18), child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('Order total', style: TextStyle(color: Colors.black54)), const SizedBox(height: 6), KesPrice(widget.order.totalKes, style: Theme.of(context).textTheme.headlineSmall)]), const Icon(Icons.lock_outline, color: Colors.green)]))),
          const SizedBox(height: 22),
          const Text('Payment method', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          _MethodTile(title: 'M-PESA', subtitle: 'Lipa na M-PESA', icon: Icons.phone_iphone, selected: _method == 'mpesa', onTap: () => setState(() => _method = 'mpesa')),
          _MethodTile(title: 'Airtel Money', subtitle: 'Coming soon', icon: Icons.phone_android, selected: _method == 'airtel', onTap: () => setState(() => _method = 'airtel')),
          _MethodTile(title: 'Card', subtitle: 'Coming soon', icon: Icons.credit_card, selected: _method == 'card', onTap: () => setState(() => _method = 'card')),
          if (_method == 'mpesa') ...[
            const SizedBox(height: 18),
            TextField(controller: _phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'M-PESA phone number', prefixIcon: Icon(Icons.phone_iphone))),
            const SizedBox(height: 12),
            const MpesaSheet(),
          ],
          if (_message != null) ...[const SizedBox(height: 14), Text(_message!, textAlign: TextAlign.center, style: TextStyle(color: _message!.contains('received') ? Colors.green : Colors.red))],
          const SizedBox(height: 24),
          ElevatedButton.icon(onPressed: _busy || _method != 'mpesa' ? null : _pay, icon: const Icon(Icons.lock), label: Text(_busy ? 'Waiting for confirmation…' : 'Pay securely')),
        ],
      ),
    );
  }

  Future<void> _pay() async {
    setState(() {
      _busy = true;
      _message = 'Check your phone for the M-PESA prompt.';
    });
    try {
      final response = await widget.controller.mpesa.initiateStkPush(
        phone: _phone.text,
        amount: widget.order.totalKes.round(),
        orderId: widget.order.id,
        orderNumber: widget.order.orderNumber,
      );
      MpesaStatus? terminal;
      await for (final status in widget.controller.mpesa.pollStatus(response.checkoutRequestId)) {
        terminal = status;
        if (status.isTerminal) break;
      }
      if (!mounted) return;
      if (terminal?.status == 'succeeded') {
        widget.controller.markOrderPaid(widget.order.id, receipt: terminal?.receipt ?? '');
        Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => ConfirmationScreen(order: widget.order, receipt: terminal?.receipt ?? '')));
      } else {
        setState(() => _message = terminal?.message.isNotEmpty == true
            ? terminal!.message
            : 'Payment was not completed. Please try again.');
      }
    } on MpesaException catch (error) {
      if (mounted) setState(() => _message = 'Payment could not start: ${error.message}');
    } catch (error) {
      if (mounted) setState(() => _message = 'Payment could not start: please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}

class _MethodTile extends StatelessWidget {
  const _MethodTile({required this.title, required this.subtitle, required this.icon, required this.selected, required this.onTap});
  final String title;
  final String subtitle;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(margin: const EdgeInsets.only(bottom: 10), child: ListTile(onTap: onTap, leading: Icon(icon), title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)), subtitle: Text(subtitle), trailing: selected ? const Icon(Icons.check_circle, color: Colors.green) : const Icon(Icons.circle_outlined)));
  }
}
