import 'package:flutter/material.dart';
import '../../core/theme/colors.dart';

class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      'paid' || 'approved' || 'delivered' || 'dispensed' => AppColors.success,
      'pending' || 'scheduled' || 'in_transit' => AppColors.warning,
      'failed' || 'cancelled' || 'expired' => AppColors.error,
      _ => AppColors.secondary,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.25)),
      ),
      child: Text(status.replaceAll('_', ' '), style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700)),
    );
  }
}
