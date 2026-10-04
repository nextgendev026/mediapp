import 'package:flutter/material.dart';
import '../../../shared/widgets/language_toggle.dart';
import '../../auth/providers/auth_provider.dart';
import 'consent_screen.dart';
import 'data_rights_screen.dart';
import 'settings_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key, required this.controller});

  final AuthProvider controller;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
        children: [
          Card(child: Padding(padding: const EdgeInsets.all(18), child: Row(children: [const CircleAvatar(radius: 28, child: Icon(Icons.person, size: 32)), const SizedBox(width: 14), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(controller.name.isEmpty ? 'AfyaCommerce patient' : controller.name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)), const SizedBox(height: 4), Text(controller.phone)])), Icon(controller.consentGiven ? Icons.verified_user : Icons.warning_amber_outlined, color: controller.consentGiven ? Colors.green : Colors.orange))])),
          const SizedBox(height: 20),
          const Text('Preferences', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          Card(child: Column(children: [ListTile(leading: const Icon(Icons.language), title: const Text('Language'), trailing: LanguageToggle(value: controller.language, onChanged: controller.setLanguage)), const Divider(height: 1), ListTile(leading: const Icon(Icons.notifications_outlined), title: const Text('Notifications'), trailing: Switch(value: true, onChanged: (_) {})), const Divider(height: 1), ListTile(leading: const Icon(Icons.settings_outlined), title: const Text('Settings'), trailing: const Icon(Icons.chevron_right), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => SettingsScreen())))])),
          const SizedBox(height: 20),
          const Text('Privacy and health data', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          Card(child: Column(children: [ListTile(leading: const Icon(Icons.privacy_tip_outlined), title: const Text('Consent management'), subtitle: const Text('Review and update permissions'), trailing: const Icon(Icons.chevron_right), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ConsentScreen(controller: controller)))), const Divider(height: 1), ListTile(leading: const Icon(Icons.download_outlined), title: const Text('My data and rights'), subtitle: const Text('Export or request deletion'), trailing: const Icon(Icons.chevron_right), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => DataRightsScreen())))])),
          const SizedBox(height: 20),
          OutlinedButton.icon(onPressed: () => controller.logout(), icon: const Icon(Icons.logout), label: const Text('Sign out')),
          const SizedBox(height: 18),
          const Center(child: Text('AfyaCommerce 1.0.0 • Data stored in Kenya', style: TextStyle(fontSize: 12, color: Colors.black54))),
        ],
      ),
    );
  }
}
