import 'package:flutter/material.dart';
import '../../../shared/models/product.dart';

class ProductSearchTile extends StatelessWidget {
  const ProductSearchTile({super.key, required this.product, required this.onTap});

  final Product product;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(onTap: onTap, leading: const CircleAvatar(child: Icon(Icons.medication_outlined)), title: Text(product.name), subtitle: Text(product.genericName));
  }
}
