import 'package:flutter/material.dart';
import '../providers/auth_provider.dart';

class OtpScreen extends StatefulWidget {
  const OtpScreen({super.key, required this.controller});

  final AuthProvider controller;

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  final _codeController = TextEditingController();
  bool _busy = false;
  int _seconds = 30;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Verify your number')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.mark_email_read_outlined, size: 64),
              const SizedBox(height: 20),
              Text('Enter the code sent to ${widget.controller.phone}', textAlign: TextAlign.center),
              const SizedBox(height: 28),
              TextField(
                controller: _codeController,
                keyboardType: TextInputType.number,
                textAlign: TextAlign.center,
                maxLength: 6,
                style: const TextStyle(fontSize: 30, letterSpacing: 10, fontWeight: FontWeight.w700),
                decoration: const InputDecoration(counterText: '', hintText: '000000'),
              ),
              const SizedBox(height: 16),
              ElevatedButton(onPressed: _busy ? null : _verify, child: Text(_busy ? 'Verifying…' : 'Verify OTP')),
              const SizedBox(height: 12),
              TextButton(onPressed: _seconds == 0 ? _resend : null, child: Text(_seconds == 0 ? 'Resend OTP' : 'Resend in ${_seconds}s')),
            ],
          ),
        ),
      ),
    );
  }

  void _startTimer() {
    Future<void>.delayed(const Duration(seconds: 1), () {
      if (!mounted) return;
      setState(() => _seconds = _seconds == 0 ? 0 : _seconds - 1);
      if (_seconds > 0) _startTimer();
    });
  }

  Future<void> _verify() async {
    if (_codeController.text.length < 4) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter the OTP code')));
      return;
    }
    setState(() => _busy = true);
    final success = await widget.controller.verifyOtp(_codeController.text);
    if (!mounted) return;
    setState(() => _busy = false);
    if (success) {
      Navigator.of(context).popUntil((route) => route.isFirst);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(widget.controller.lastError ?? 'Invalid OTP')));
    }
  }

  void _resend() {
    setState(() => _seconds = 30);
    _startTimer();
  }
}
