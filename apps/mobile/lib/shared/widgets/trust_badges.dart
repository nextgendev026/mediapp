import 'package:flutter/material.dart';
import '../../core/theme/colors.dart';

class TrustBadges extends StatelessWidget {
  const TrustBadges({super.key});

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 12,
      runSpacing: 8,
      children: const [
        _Badge(icon: Icons.verified_user_outlined, label: 'PPB licensed'),
        _Badge(icon: Icons.local_hospital_outlined, label: 'KMHFR registered'),
        _Badge(icon: Icons.shield_outlined, label: 'SHA ready'),
      ],
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 15, color: AppColors.primaryDark),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
      ],
    );
  }
}
