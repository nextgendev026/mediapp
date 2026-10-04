import 'package:flutter/material.dart';
import '../../auth/providers/auth_provider.dart';
import '../../../shared/widgets/kes_price.dart';
import '../../../shared/widgets/trust_badges.dart';

class BookingWizardScreen extends StatefulWidget {
  const BookingWizardScreen({super.key, required this.controller});

  final AuthProvider controller;

  @override
  State<BookingWizardScreen> createState() => _BookingWizardScreenState();
}

class _BookingWizardScreenState extends State<BookingWizardScreen> {
  int _step = 0;
  String _type = 'Video consultation';
  DateTime _slot = DateTime.now().add(const Duration(days: 1, hours: 2));
  final _symptoms = TextEditingController();
  bool _paying = false;

  @override
  void dispose() {
    _symptoms.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final titles = ['Choose a slot', 'Tell us what you need', 'Review and confirm'];
    return Scaffold(
      appBar: AppBar(title: Text('Step ${_step + 1} of ${titles.length}')),
      body: SafeArea(
        child: Column(
          children: [
            LinearProgressIndicator(value: (_step + 1) / titles.length.toDouble()),
            Expanded(child: _body(titles[_step])),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Row(
                children: [
                  if (_step > 0) Expanded(child: OutlinedButton(onPressed: () => setState(() => _step--), child: const Text('Back'))),
                  if (_step > 0) const SizedBox(width: 12),
                  Expanded(child: ElevatedButton(onPressed: _paying ? null : _next, child: Text(_step == titles.length - 1 ? (_paying ? 'Confirming…' : 'Confirm booking') : 'Continue'))),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _body(String title) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(title, style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 20),
        if (_step == 0) ...[
          const Text('Select consultation type'),
          const SizedBox(height: 10),
          _Choice(label: 'Video consultation', icon: Icons.videocam_outlined, selected: _type == 'Video consultation', onTap: () => setState(() => _type = 'Video consultation')),
          _Choice(label: 'Voice consultation', icon: Icons.call_outlined, selected: _type == 'Voice consultation', onTap: () => setState(() => _type = 'Voice consultation')),
          _Choice(label: 'Chat consultation', icon: Icons.chat_bubble_outline, selected: _type == 'Chat consultation', onTap: () => setState(() => _type = 'Chat consultation')),
          const SizedBox(height: 20),
          const Text('Available slots', style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          Wrap(spacing: 8, runSpacing: 8, children: [10, 11, 12].map((day) => ChoiceChip(label: Text('${day} Aug'), selected: _slot.day == day, onSelected: (_) => setState(() => _slot = DateTime(2026, 8, day, 10)))).toList()),
        ] else if (_step == 1) ...[
          const Text('Briefly describe your symptoms or request. A clinician will review this before the call.'),
          const SizedBox(height: 12),
          TextField(controller: _symptoms, minLines: 6, maxLines: 10, decoration: const InputDecoration(hintText: 'Describe how you feel and when it started')),
          const SizedBox(height: 16),
          const TrustBadges(),
        ] else ...[
          Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(_type, style: const TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text('Slot: ${_slot.day}/${_slot.month}/${_slot.year}, ${_slot.hour.toString().padLeft(2, '0')}:00'),
            const SizedBox(height: 8),
            Text('Symptoms: ${_symptoms.text.isEmpty ? 'Not provided' : _symptoms.text}'),
            const Divider(height: 28),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [const Text('Consultation fee'), KesPrice(1500)]),
          ]))),
          const SizedBox(height: 16),
          const Text('Your information is encrypted in transit and stored on Kenyan infrastructure.', style: TextStyle(color: Colors.black54)),
        ],
      ],
    );
  }

  Future<void> _next() async {
    if (_step < 2) {
      setState(() => _step++);
      return;
    }
    setState(() => _paying = true);
    await Future<void>.delayed(const Duration(milliseconds: 450));
    if (!mounted) return;
    setState(() => _paying = false);
    showDialog<void>(context: context, builder: (context) => AlertDialog(title: const Text('Consultation booked'), content: const Text('Your clinician will be notified. You will receive an SMS reminder before the appointment.'), actions: [TextButton(onPressed: () { Navigator.pop(context); Navigator.pop(context); }, child: const Text('Done'))]));
  }
}

class _Choice extends StatelessWidget {
  const _Choice({required this.label, required this.icon, required this.selected, required this.onTap});
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 4),
      leading: Icon(icon),
      title: Text(label),
      trailing: selected ? const Icon(Icons.check_circle, color: Colors.green) : const Icon(Icons.circle_outlined),
    );
  }
}
