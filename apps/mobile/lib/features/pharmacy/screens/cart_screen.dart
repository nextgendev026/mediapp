import 'package:flutter/material.dart';
import '../../../shared/models/product.dart';
import '../../../shared/widgets/kes_price.dart';
import '../../auth/providers/auth_provider.dart';
import '../../checkout/screens/delivery_screen.dart';

class CartScreen extends StatelessWidget {
  const CartScreen({super.key, required this.controller});

  final AuthProvider controller;

  @override
  Widget build(BuildContext context) {
    final products = controller.catalog.where((product) => controller.cartCount > 0 && _hasItem(product)).toList();
    return Scaffold(
      appBar: AppBar(title: const Text('Your cart')),
      body: products.isEmpty
          ? const Center(child: Text('Your cart is empty.'))
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
              children: [
                ...products.map((product) => _CartLine(product: product, controller: controller)),
                const SizedBox(height: 12),
                Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(children: [Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [const Text('Subtotal'), KesPrice(controller.cartTotal)]), const SizedBox(height: 8), const Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text('Delivery'), Text('Calculated at checkout')])]))),
                const SizedBox(height: 20),
                ElevatedButton.icon(onPressed: products.isEmpty ? null : () => Navigator.push(context, MaterialPageRoute(builder: (_) => DeliveryScreen(controller: controller))), icon: const Icon(Icons.arrow_forward), label: const Text('Continue to delivery')),
              ],
            ),
    );
  }

  bool _hasItem(Product product) {
    return controller.cartContains(product.id);
  }
}

class _CartLine extends StatelessWidget {
  const _CartLine({required this.product, required this.controller});
  final Product product;
  final AuthProvider controller;

  @override
  Widget build(BuildContext context) {
    final quantity = controller.cartQuantity(product.id);
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(children: [Container(width: 54, height: 54, decoration: BoxDecoration(color: Colors.blue.shade50, borderRadius: BorderRadius.circular(12)), child: const Icon(Icons.medication_outlined)), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(product.name, style: const TextStyle(fontWeight: FontWeight.w800)), const SizedBox(height: 4), KesPrice(product.priceKes, style: const TextStyle(fontSize: 13))])), IconButton(onPressed: () => controller.removeFromCart(product.id), icon: const Icon(Icons.remove_circle_outline)), Text('$quantity', style: const TextStyle(fontWeight: FontWeight.w800)), IconButton(onPressed: () => controller.addToCart(product), icon: const Icon(Icons.add_circle_outline))]),
      ),
    );
  }
}
