import 'package:flutter/material.dart';
import '../../../core/services/consent_service.dart';
import '../../auth/providers/auth_provider.dart';

class ConsentScreen extends StatefulWidget {
  const ConsentScreen({super.key, required this.controller});

  final AuthProvider controller;

  @override
  State<ConsentScreen> createState() => _ConsentScreenState();
}

class _ConsentScreenState extends State<ConsentScreen> {
  static const _types = <String, String>{
    'phi_processing': 'Health information for treatment',
    'telehealth': 'Telehealth consultations',
    'pharmacy_sharing': 'Prescription sharing with a pharmacy',
    'sms_updates': 'SMS delivery updates',
    'marketing': 'Product recommendations',
  };

  final ConsentService _service = ConsentService();
  final Map<String, ConsentRecord> _records = {};
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final session = widget.controller.session;
    if (session == null) {
      setState(() {
        _loading = false;
        _error = 'Please sign in again to manage consent.';
      });
      return;
    }
    setState(() => _loading = true);
    try {
      final records = await _service.load(session);
      if (!mounted) return;
      setState(() {
        _records
          ..clear()
          ..addEntries(records.map((record) => MapEntry(record.type, record)));
        _loading = false;
        _error = null;
      });
    } on ConsentException catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.message;
      });
    }
  }

  Future<void> _toggle(String type, bool value) async {
    final session = widget.controller.session;
    if (session == null) return;
    setState(() => _error = null);
    try {
      final records = await _service.setConsent(session, type: type, granted: value);
      if (!mounted) return;
      setState(() {
        _records
          ..clear()
          ..addEntries(records.map((record) => MapEntry(record.type, record)));
        _records[type] = ConsentRecord(
          type: type,
          granted: value,
          grantedAt: value ? DateTime.now() : null,
          revokedAt: value ? null : DateTime.now(),
          policyVersion: _records[type]?.policyVersion,
        );
      });
    } on ConsentException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Consent management')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
              children: [
                const Text('You control how your information is used. Required treatment consent cannot be disabled while an active order or consultation exists.'),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: const TextStyle(color: Colors.red)),
                ],
                const SizedBox(height: 18),
                ..._types.entries.map((entry) {
                  final record = _records[entry.key];
                  final granted = record?.granted ?? false;
                  return Card(
                    margin: const EdgeInsets.only(bottom: 10),
                    child: SwitchListTile(
                      value: granted,
                      onChanged: (value) => _toggle(entry.key, value),
                      title: Text(entry.value),
                      subtitle: Text(record == null
                          ? 'Not recorded'
                          : granted
                              ? 'Granted ${record.grantedAt != null ? 'on ${record.grantedAt!.toIso8601String().substring(0, 10)}' : ''}${record.policyVersion != null ? ' • policy ${record.policyVersion}' : ''}'
                              : 'Withdrawn${record.revokedAt != null ? ' on ${record.revokedAt!.toIso8601String().substring(0, 10)}' : ''}'),
                    ),
                  );
                }),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: _load,
                  icon: const Icon(Icons.history),
                  label: const Text('Refresh consent history'),
                ),
              ],
            ),
    );
  }
}
