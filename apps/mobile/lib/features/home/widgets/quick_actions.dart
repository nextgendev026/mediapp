import 'package:flutter/material.dart';
import '../../auth/providers/auth_provider.dart';

class QuickActions extends StatelessWidget {
  const QuickActions({super.key, required this.controller, required this.onNavigate});

  final AuthProvider controller;
  final ValueChanged<int> onNavigate;

  @override
  Widget build(BuildContext context) {
    final actions = [
      _Action(Icons.video_call_outlined, 'Consult', () => onNavigate(1)),
      _Action(Icons.shopping_bag_outlined, 'Pharmacy', () => onNavigate(2)),
      _Action(Icons.receipt_long_outlined, 'Orders', () => onNavigate(3)),
      _Action(Icons.emergency_outlined, 'Emergency', () => _showEmergency(context)),
    ];
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: actions.map((action) => Expanded(child: _ActionTile(action: action))).toList(),
    );
  }

  void _showEmergency(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Need urgent help?'),
        content: const Text('For an emergency, call 999 or 112 immediately. AfyaCommerce is not an emergency service.'),
        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close'))],
      ),
    );
  }
}

class _Action {
  const _Action(this.icon, this.label, this.onTap);
  final IconData icon;
  final String label;
  final VoidCallback onTap;
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({required this.action});
  final _Action action;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: action.onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Column(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(color: Theme.of(context).colorScheme.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(16)),
              child: Icon(action.icon, color: Theme.of(context).colorScheme.primary),
            ),
            const SizedBox(height: 8),
            Text(action.label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    );
  }
}
