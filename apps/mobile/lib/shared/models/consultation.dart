class Consultation {
  const Consultation({
    required this.id,
    required this.provider,
    required this.speciality,
    required this.scheduledAt,
    required this.type,
    required this.status,
    required this.feeKes,
  });

  final String id;
  final String provider;
  final String speciality;
  final DateTime scheduledAt;
  final String type;
  final String status;
  final double feeKes;
}
