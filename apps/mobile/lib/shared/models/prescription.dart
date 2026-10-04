class Prescription {
  const Prescription({
    required this.id,
    required this.medication,
    required this.dosage,
    required this.frequency,
    required this.status,
    required this.createdAt,
    this.refillsRemaining = 0,
    this.shaStatus = 'not_submitted',
  });

  final String id;
  final String medication;
  final String dosage;
  final String frequency;
  final String status;
  final DateTime createdAt;
  final int refillsRemaining;
  final String shaStatus;
}
