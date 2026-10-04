import 'package:flutter/material.dart';
import '../../../core/config/env.dart';
import '../providers/auth_provider.dart';
import 'otp_screen.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key, required this.controller});

  final AuthProvider? controller;

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _consent = false;
  bool _busy = false;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Create your profile')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('A few details help us provide safe care.'),
                const SizedBox(height: 24),
                TextFormField(
                  controller: _nameController,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(labelText: 'Full name', prefixIcon: Icon(Icons.person_outline)),
                  validator: (value) => (value == null || value.trim().isEmpty) ? 'Enter your full name' : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: 'Mobile number', prefixIcon: Icon(Icons.phone_iphone)),
                  validator: (value) => (value == null || !isValidKenyanPhone(value)) ? 'Enter a valid Kenyan number' : null,
                ),
                const SizedBox(height: 14),
                const TextField(decoration: InputDecoration(labelText: 'SHA number (optional)'), keyboardType: TextInputType.number),
                const SizedBox(height: 16),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _consent,
                  onChanged: (value) => setState(() => _consent = value ?? false),
                  title: const Text('I consent to processing my health information for treatment, payment and delivery.'),
                  controlAffinity: ListTileControlAffinity.leading,
                ),
                const SizedBox(height: 16),
                ElevatedButton(onPressed: _busy || widget.controller == null ? null : _save, child: Text(_busy ? 'Sending code…' : 'Continue')),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (!_consent) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Consent is required to create an account')));
      return;
    }
    setState(() => _busy = true);
    final sent = await widget.controller!.startRegistration(
      fullName: _nameController.text,
      phone: _phoneController.text,
      consent: _consent,
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (!sent) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(widget.controller!.lastError ?? 'We could not send the code.')));
      return;
    }
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => OtpScreen(controller: widget.controller!)),
    );
  }
}
