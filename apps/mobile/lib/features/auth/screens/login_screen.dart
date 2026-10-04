import 'package:flutter/material.dart';
import '../../../core/config/env.dart';
import '../providers/auth_provider.dart';
import 'otp_screen.dart';
import 'register_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, this.controller});

  final AuthProvider? controller;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phoneController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _busy = false;

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 40, 24, 24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(color: Theme.of(context).colorScheme.primary, borderRadius: BorderRadius.circular(20)),
                  child: const Icon(Icons.local_hospital, color: Colors.white, size: 40),
                ),
                const SizedBox(height: 28),
                Text('Welcome back', style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 8),
                const Text('Consult trusted doctors and receive health products at your door.'),
                const SizedBox(height: 32),
                TextFormField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  textInputAction: TextInputAction.done,
                  decoration: const InputDecoration(labelText: 'Mobile number', prefixText: '+254 ', prefixIcon: Icon(Icons.phone_iphone)),
                  validator: (value) {
                    if (value == null || !isValidKenyanPhone(value)) return 'Enter a valid Kenyan number';
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: _busy || widget.controller == null ? null : _sendOtp,
                  child: Text(_busy ? 'Sending…' : 'Send OTP'),
                ),
                const SizedBox(height: 14),
                OutlinedButton.icon(
                  onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => RegisterScreen(controller: widget.controller))),
                  icon: const Icon(Icons.person_add_alt_1_outlined),
                  label: const Text('Create an account'),
                ),
                const SizedBox(height: 24),
                TextButton.icon(
                  onPressed: () => _showFallback(context),
                  icon: const Icon(Icons.phone_in_talk_outlined),
                  label: const Text('Order by SMS or USSD'),
                ),
                const SizedBox(height: 24),
                const Text('By continuing, you agree to the AfyaCommerce terms and privacy notice.', style: TextStyle(fontSize: 12, color: Colors.black54)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _sendOtp() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _busy = true);
    final sent = await widget.controller!.requestOtp(_phoneController.text);
    if (!mounted) return;
    setState(() => _busy = false);
    if (!sent) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(widget.controller!.lastError ?? 'Unable to send OTP')));
      return;
    }
    Navigator.push(context, MaterialPageRoute(builder: (_) => OtpScreen(controller: widget.controller!)));
  }

  void _showFallback(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      builder: (context) => const Padding(
        padding: EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Low-data ordering', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            SizedBox(height: 12),
            Text('Dial *334# to pay a PayBill or send your order request by SMS when data is limited.'),
            SizedBox(height: 18),
            Text('USSD availability depends on your mobile operator and handset.'),
          ],
        ),
      ),
    );
  }
}
