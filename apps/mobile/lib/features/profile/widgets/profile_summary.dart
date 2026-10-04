import 'package:flutter/material.dart';

class ProfileSummary extends StatelessWidget {
  const ProfileSummary({super.key, required this.name, required this.phone});

  final String name;
  final String phone;

  @override
  Widget build(BuildContext context) {
    return ListTile(leading: const CircleAvatar(child: Icon(Icons.person)), title: Text(name), subtitle: Text(phone));
  }
}
