import 'package:flutter/material.dart';
import '../../core/theme/colors.dart';

class LanguageToggle extends StatelessWidget {
  const LanguageToggle({super.key, required this.value, required this.onChanged});

  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return SegmentedButton<String>(
      segments: const [
        ButtonSegment(value: 'en', label: Text('EN')),
        ButtonSegment(value: 'sw', label: Text('SW')),
      ],
      selected: {value},
      onSelectionChanged: (selection) => onChanged(selection.first),
      style: ButtonStyle(
        visualDensity: VisualDensity.compact,
        textStyle: MaterialStatePropertyAll(TextStyle(color: AppColors.ink, fontSize: 12)),
      ),
    );
  }
}
