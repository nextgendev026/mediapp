import 'package:flutter/material.dart';
import '../../core/theme/colors.dart';

class KesPrice extends StatelessWidget {
  const KesPrice(this.amount, {super.key, this.style});

  final double amount;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    final formatted = amount.toStringAsFixed(amount.truncateToDouble() == amount ? 0 : 2);
    final parts = formatted.split('.');
    final whole = parts.first;
    final buffer = StringBuffer();
    for (var index = 0; index < whole.length; index++) {
      if (index > 0 && (whole.length - index) % 3 == 0) buffer.write(',');
      buffer.write(whole[index]);
    }
    final value = parts.length == 1 ? buffer.toString() : '${buffer.toString()}.${parts[1]}';
    return Text('KES $value', style: style ?? Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800, color: AppColors.ink));
  }
}
