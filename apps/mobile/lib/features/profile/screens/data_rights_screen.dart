import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class DataRightsScreen extends StatelessWidget {
  const DataRightsScreen({super.key});

  static const _privacyEmail = 'privacy@afyacommerce.co.ke';
  static const _privacyPhone = '+254 700 000 000';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My data and rights')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        children: [
          const Text('Under the Kenya Data Protection Act, you can request access, portability, correction, or deletion of your personal data.'),
          const SizedBox(height: 14),
          const Text(
            'Requests are handled by our data protection officer and must be verified against the phone number on your account. Submit the request using the channel below, then sign in to follow its status.',
            style: TextStyle(color: Colors.black54),
          ),
          const SizedBox(height: 20),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.mail_outline),
                  title: const Text('Email your request'),
                  subtitle: const Text(_privacyEmail),
                  trailing: const Icon(Icons.copy_all_outlined),
                  onTap: () => _copy(context, _privacyEmail, 'Email address copied'),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.phone_in_talk_outlined),
                  title: const Text('Call our data protection officer'),
                  subtitle: const Text(_privacyPhone),
                  trailing: const Icon(Icons.copy_all_outlined),
                  onTap: () => _copy(context, _privacyPhone, 'Phone number copied'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          const Card(
            child: ListTile(
              leading: Icon(Icons.privacy_tip_outlined, color: Colors.green),
              title: Text('Your privacy matters'),
              subtitle: Text('We never sell personal health information. Access is logged for your protection, and clinical and audit records are retained only for as long as the law requires.'),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _copy(BuildContext context, String value, String confirmation) async {
    await Clipboard.setData(ClipboardData(text: value));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(confirmation)));
  }
}
