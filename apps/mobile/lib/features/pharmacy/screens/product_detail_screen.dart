import 'package:flutter/material.dart';
import '../../../shared/models/product.dart';
import '../../../shared/widgets/kes_price.dart';
import '../../../shared/widgets/trust_badges.dart';
import '../../auth/providers/auth_provider.dart';

class ProductDetailScreen extends StatefulWidget {
  const ProductDetailScreen({super.key, required this.product, required this.controller});

  final Product product;
  final AuthProvider controller;

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  int _quantity = 1;

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    return Scaffold(
      appBar: AppBar(title: const Text('Product details')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
        children: [
          Container(height: 220, decoration: BoxDecoration(color: Colors.blue.shade50, borderRadius: BorderRadius.circular(20)), child: const Icon(Icons.medication_outlined, size: 90, color: Colors.blueGrey)),
          const SizedBox(height: 20),
          Text(product.name, style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 6),
          Text('${product.genericName}${product.swahiliName.isEmpty ? '' : ' • ${product.swahiliName}'}', style: const TextStyle(color: Colors.black54)),
          const SizedBox(height: 14),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [KesPrice(product.priceKes, style: Theme.of(context).textTheme.headlineSmall), Chip(label: Text('${product.stock} in stock'))]),
          const SizedBox(height: 18),
          const TrustBadges(),
          const SizedBox(height: 20),
          Text(product.pharmacy, style: const TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          const Text('Dispensed by a licensed Kenyan pharmacy partner.'),
          if (product.requiresPrescription) ...[const SizedBox(height: 18), Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: Colors.orange.shade50, borderRadius: BorderRadius.circular(12)), child: const Row(children: [Icon(Icons.info_outline, color: Colors.orange), SizedBox(width: 8), Expanded(child: Text('A valid prescription is required before dispensing.'))]))],
          const SizedBox(height: 20),
          Row(children: [IconButton.filledTonal(onPressed: _quantity > 1 ? () => setState(() => _quantity--) : null, icon: const Icon(Icons.remove)), const SizedBox(width: 16), Text('$_quantity', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)), const SizedBox(width: 16), IconButton.filledTonal(onPressed: () => setState(() => _quantity++), icon: const Icon(Icons.add))]),
          const SizedBox(height: 22),
          ElevatedButton.icon(onPressed: _addToCart, icon: const Icon(Icons.add_shopping_cart), label: const Text('Add to cart')),
        ],
      ),
    );
  }

  void _addToCart() {
    for (var index = 0; index < _quantity; index++) {
      widget.controller.addToCart(widget.product);
    }
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${widget.product.name} added to cart')));
    Navigator.pop(context);
  }
}
