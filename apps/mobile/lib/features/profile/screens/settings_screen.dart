import 'package:flutter/material.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: const [Card(child: Column(children: [ListTile(leading: Icon(Icons.wifi_off_outlined), title: Text('Low-data mode'), subtitle: Text('Reduce images and background activity')), Divider(height: 1), ListTile(leading: Icon(Icons.location_on_outlined), title: Text('Location access'), subtitle: Text('Only used when you share a delivery pin')), Divider(height: 1), ListTile(leading: Icon(Icons.security_outlined), title: Text('Security'), subtitle: Text('Biometric and MFA settings'))])), SizedBox(height: 18), Text('AfyaCommerce uses encrypted connections and stores health information on Kenyan infrastructure.', style: TextStyle(color: Colors.black54))],
      ),
    );
  }
}
