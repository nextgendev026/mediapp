class Product {
  const Product({
    required this.id,
    required this.name,
    required this.genericName,
    required this.category,
    required this.priceKes,
    required this.stock,
    required this.requiresPrescription,
    this.pharmacy = 'Nairobi Health Pharmacy',
    this.swahiliName = '',
  });

  final String id;
  final String name;
  final String genericName;
  final String category;
  final double priceKes;
  final int stock;
  final bool requiresPrescription;
  final String pharmacy;
  final String swahiliName;

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: '${json['id'] ?? ''}',
      name: '${json['name'] ?? ''}',
      genericName: '${json['generic_name'] ?? json['genericName'] ?? ''}',
      category: '${json['category'] ?? 'otc'}',
      priceKes: (json['price_kes'] ?? json['priceKes'] ?? 0).toDouble(),
      stock: (json['stock_quantity'] ?? json['stock'] ?? 0).toInt(),
      requiresPrescription: json['requires_prescription'] == true || json['requiresPrescription'] == true,
      pharmacy: '${json['pharmacy'] ?? 'AfyaCommerce Pharmacy'}',
      swahiliName: '${json['swahili_name'] ?? json['swahiliName'] ?? ''}',
    );
  }
}
