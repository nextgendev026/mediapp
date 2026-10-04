import 'package:flutter/material.dart';
import '../../../core/theme/colors.dart';

class MpesaSheet extends StatelessWidget {
  const MpesaSheet({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(14)),
      child: const Row(children: [Icon(Icons.phone_iphone, color: AppColors.primaryDark), SizedBox(width: 12), Expanded(child: Text('You will receive a secure M-PESA prompt. Enter your PIN on your phone to complete payment.', style: TextStyle(fontSize: 13)))]),
    );
  }
}
