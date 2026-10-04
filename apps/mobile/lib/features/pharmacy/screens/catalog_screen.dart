import 'package:flutter/material.dart';
import '../../../shared/models/product.dart';
import '../../../shared/widgets/kes_price.dart';
import '../../../shared/widgets/trust_badges.dart';
import '../../auth/providers/auth_provider.dart';
import 'cart_screen.dart';
import 'product_detail_screen.dart';

class CatalogScreen extends StatefulWidget {
  const CatalogScreen({super.key, required this.controller});

  final AuthProvider controller;

  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  final _search = TextEditingController();
  String _category = 'all';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final products = widget.controller.catalog.where((product) {
      final query = _search.text.toLowerCase();
      final matchesQuery = query.isEmpty || product.name.toLowerCase().contains(query) || product.genericName.toLowerCase().contains(query) || product.swahiliName.toLowerCase().contains(query);
      final matchesCategory = _category == 'all' || product.category == _category;
      return matchesQuery && matchesCategory;
    }).toList();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Pharmacy'),
        actions: [IconButton(onPressed: _openCart, icon: Badge(label: Text('${widget.controller.cartCount}'), child: const Icon(Icons.shopping_cart_outlined)))],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: TextField(controller: _search, onChanged: (_) => setState(() {}), decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Search medicines or symptoms', suffixIcon: Icon(Icons.mic_none))),
            ),
            SizedBox(
              height: 52,
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                scrollDirection: Axis.horizontal,
                children: ['all', 'prescription', 'otc', 'device', 'supplement'].map((category) => Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(label: Text(_label(category)), selected: _category == category, onSelected: (_) => setState(() => _category = category)))).toList(),
              ),
            ),
            const Padding(padding: EdgeInsets.fromLTRB(20, 8, 20, 8), child: Align(alignment: Alignment.centerLeft, child: TrustBadges())),
            Expanded(
              child: products.isEmpty
                  ? const Center(child: Text('No products match your search.'))
                  : GridView.builder(
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, crossAxisSpacing: 12, mainAxisSpacing: 12, childAspectRatio: 0.72),
                      itemBuilder: (context, index) => _ProductCard(product: products[index], onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ProductDetailScreen(product: products[index], controller: widget.controller)))),
                    ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(onPressed: _openCart, icon: const Icon(Icons.shopping_cart), label: Text('Cart ${widget.controller.cartCount}')),
    );
  }

  String _label(String value) {
    return value[0].toUpperCase() + value.substring(1);
  }

  void _openCart() {
    Navigator.push(context, MaterialPageRoute(builder: (_) => CartScreen(controller: widget.controller)));
  }
}

class _ProductCard extends StatelessWidget {
  const _ProductCard({required this.product, required this.onTap});
  final Product product;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: Container(width: double.infinity, decoration: BoxDecoration(color: Colors.blue.shade50, borderRadius: BorderRadius.circular(12)), child: const Icon(Icons.medication_outlined, size: 42))),
            const SizedBox(height: 10),
            Text(product.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Text(product.genericName, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: Colors.black54)),
            const Spacer(),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [KesPrice(product.priceKes, style: const TextStyle(fontSize: 13)), if (product.requiresPrescription) const Icon(Icons.receipt_long, size: 17, color: Colors.orange)]),
          ]),
        ),
      ),
    );
  }
}
