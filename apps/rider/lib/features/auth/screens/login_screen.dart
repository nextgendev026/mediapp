import 'package:flutter/material.dart';
import '../../../app.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.controller});

  final RiderController controller;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phone = TextEditingController();
  final _otp = TextEditingController();
  bool _codeSent = false;

  @override
  void dispose() {
    _phone.dispose();
    _otp.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 48, 24, 24),
          children: [
            Container(width: 76, height: 76, decoration: BoxDecoration(color: Colors.green, borderRadius: BorderRadius.circular(20)), child: const Icon(Icons.two_wheeler, color: Colors.white, size: 42)),
            const SizedBox(height: 24),
            Text('Rider sign in', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            const Text('Accept medicine deliveries and get paid to your M-PESA account.'),
            const SizedBox(height: 28),
            TextField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              readOnly: _codeSent,
              decoration: const InputDecoration(labelText: 'Phone number', prefixText: '+254 '),
            ),
            if (_codeSent) ...[
              const SizedBox(height: 14),
              TextField(
                controller: _otp,
                keyboardType: TextInputType.number,
                maxLength: 6,
                decoration: const InputDecoration(labelText: 'SMS code', counterText: ''),
              ),
            ],
            const SizedBox(height: 18),
            ElevatedButton(
              onPressed: widget.controller.busy ? null : (_codeSent ? _confirm : _request),
              child: Text(widget.controller.busy ? 'Please wait…' : (_codeSent ? 'Verify and sign in' : 'Send me a code')),
            ),
            if (_codeSent) ...[
              const SizedBox(height: 10),
              TextButton(onPressed: widget.controller.busy ? null : _request, child: const Text('Use a different number')),
            ],
            if (widget.controller.error != null) ...[
              const SizedBox(height: 12),
              Text(widget.controller.error!, style: const TextStyle(color: Colors.red)),
            ],
            const SizedBox(height: 16),
            const Text('By signing in, you confirm that you hold a valid pharmaceutical transport licence. Every sign-in is verified by SMS.', style: TextStyle(fontSize: 12, color: Colors.black54)),
          ],
        ),
      ),
    );
  }

  Future<void> _request() async {
    final sent = await widget.controller.requestOtp(_phone.text);
    if (!mounted) return;
    if (sent) setState(() => _codeSent = true);
  }

  Future<void> _confirm() async {
    await widget.controller.confirmOtp(_otp.text);
  }
}
