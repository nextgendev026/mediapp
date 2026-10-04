class Order {
  const Order({
    required this.id,
    required this.orderNumber,
    required this.createdAt,
    required this.totalKes,
    required this.paymentStatus,
    required this.deliveryStatus,
    required this.items,
    required this.landmark,
  });

  final String id;
  final String orderNumber;
  final DateTime createdAt;
  final double totalKes;
  final String paymentStatus;
  final String deliveryStatus;
  final int items;
  final String landmark;

  Order copyWith({String? deliveryStatus, String? paymentStatus}) {
    return Order(
      id: id,
      orderNumber: orderNumber,
      createdAt: createdAt,
      totalKes: totalKes,
      paymentStatus: paymentStatus ?? this.paymentStatus,
      deliveryStatus: deliveryStatus ?? this.deliveryStatus,
      items: items,
      landmark: landmark,
    );
  }
}
