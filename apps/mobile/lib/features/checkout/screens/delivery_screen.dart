import 'package:flutter/material.dart';
import '../../../core/config/env.dart';
import '../../../core/services/order_service.dart';
import '../../auth/providers/auth_provider.dart';
import '../../../shared/widgets/kes_price.dart';
import 'payment_screen.dart';

class DeliveryScreen extends StatefulWidget {
  const DeliveryScreen({super.key, required this.controller});

  final AuthProvider controller;

  @override
  State<DeliveryScreen> createState() => _DeliveryScreenState();
}

class _DeliveryScreenState extends State<DeliveryScreen> {
  final _landmark = TextEditingController();
  final _phone = TextEditingController();
  String _method = 'boda';
  String _county = 'Nairobi';
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _phone.text = widget.controller.phone;
  }

  @override
  void dispose() {
    _landmark.dispose();
    _phone.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Delivery details')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        children: [
          Text('Where should we deliver?', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 8),
          const Text('Your phone number and landmark are used instead of a street address.'),
          const SizedBox(height: 20),
          TextField(controller: _phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Delivery phone', prefixIcon: Icon(Icons.phone_iphone))),
          const SizedBox(height: 14),
          TextField(controller: _landmark, decoration: const InputDecoration(labelText: 'Nearest landmark', hintText: 'e.g. Near Equity Bank, Kasarani', prefixIcon: Icon(Icons.location_on_outlined))),
          const SizedBox(height: 14),
          DropdownButtonFormField<String>(value: _county, decoration: const InputDecoration(labelText: 'County'), items: const ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Uasin Gishu', 'Kiambu'].map((county) => DropdownMenuItem(value: county, child: Text(county))).toList(), onChanged: (value) => setState(() => _county = value ?? _county)),
          const SizedBox(height: 24),
          const Text('Choose delivery method', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          _DeliveryOption(title: 'Boda-boda', subtitle: 'Same-day delivery, about 2 hours', price: 200, icon: Icons.two_wheeler, value: 'boda', selected: _method == 'boda', onTap: () => setState(() => _method = 'boda')),
          _DeliveryOption(title: 'Pick-up point', subtitle: 'Collect within 24 hours', price: 50, icon: Icons.storefront_outlined, value: 'pickup', selected: _method == 'pickup', onTap: () => setState(() => _method = 'pickup')),
          _DeliveryOption(title: 'Clinic collection', subtitle: 'Collect at a participating clinic', price: 0, icon: Icons.local_hospital_outlined, value: 'clinic', selected: _method == 'clinic', onTap: () => setState(() => _method = 'clinic')),
          const SizedBox(height: 22),
          Card(child: Padding(padding: const EdgeInsets.all(16), child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [const Text('Estimated delivery'), Text(_method == 'boda' ? 'KES 200' : _method == 'pickup' ? 'KES 50' : 'Free', style: const TextStyle(fontWeight: FontWeight.w800))]))),
          const SizedBox(height: 18),
          ElevatedButton(onPressed: _busy ? null : _continue, child: Text(_busy ? 'Reserving your order…' : 'Continue to payment')),
        ],
      ),
    );
  }

  void _continue() async {
    if (_landmark.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Add a landmark so the rider can find you')));
      return;
    }
    if (_method != 'pickup' && !isValidKenyanPhone(_phone.text)) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter a valid delivery phone number')));
      return;
    }
    setState(() => _busy = true);
    try {
      final order = await widget.controller.reserveOrder(
        landmark: _landmark.text.trim(),
        deliveryMethod: _method,
        county: _county,
        phone: _phone.text,
      );
      if (!mounted) return;
      Navigator.push(context, MaterialPageRoute(builder: (_) => PaymentScreen(controller: widget.controller, order: order)));
    } on OrderException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}

class _DeliveryOption extends StatelessWidget {
  const _DeliveryOption({required this.title, required this.subtitle, required this.price, required this.icon, required this.value, required this.selected, required this.onTap});
  final String title;
  final String subtitle;
  final int price;
  final IconData icon;
  final String value;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      color: selected ? Theme.of(context).colorScheme.primary.withOpacity(0.06) : Colors.white,
      child: ListTile(onTap: onTap, contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4), leading: Icon(icon, color: selected ? Theme.of(context).colorScheme.primary : Colors.black54), title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)), subtitle: Text(subtitle), trailing: Row(mainAxisSize: MainAxisSize.min, children: [if (price > 0) KesPrice(price.toDouble(), style: const TextStyle(fontSize: 12)), const SizedBox(width: 8), if (selected) const Icon(Icons.check_circle, color: Colors.green)])),
    );
  }
}
