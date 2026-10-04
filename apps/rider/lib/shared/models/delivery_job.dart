class DeliveryJob {
  const DeliveryJob({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.pickup,
    required this.dropoff,
    required this.patientPhone,
    this.feeKes = 0,
    this.distanceKm = 0,
    this.items = 0,
    this.expiresInSeconds = 0,
  });

  final String id;
  final String orderNumber;
  final String status;
  final String pickup;
  final String dropoff;
  final String patientPhone;
  final int feeKes;
  final double distanceKm;
  final int items;
  final int expiresInSeconds;
}
