import 'package:flutter/material.dart';
import '../../auth/providers/auth_provider.dart';

class UploadPrescriptionScreen extends StatefulWidget {
  const UploadPrescriptionScreen({super.key, required this.controller});

  final AuthProvider controller;

  @override
  State<UploadPrescriptionScreen> createState() => _UploadPrescriptionScreenState();
}

class _UploadPrescriptionScreenState extends State<UploadPrescriptionScreen> {
  final _medication = TextEditingController();
  bool _uploaded = false;
  bool _saving = false;

  @override
  void dispose() {
    _medication.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Upload prescription')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        children: [
          const Text('Upload a clear photo or PDF. A pharmacist will verify it before dispensing.'),
          const SizedBox(height: 20),
          Card(child: InkWell(borderRadius: BorderRadius.circular(16), onTap: _selectFile, child: Padding(padding: const EdgeInsets.all(28), child: Column(children: [_Icon(_uploaded), const SizedBox(height: 12), Text(_uploaded ? 'prescription.jpg selected' : 'Choose from gallery or camera', style: const TextStyle(fontWeight: FontWeight.w700)), const SizedBox(height: 6), const Text('JPG, PNG or PDF • maximum 10 MB')])))),
          const SizedBox(height: 20),
          TextField(controller: _medication, decoration: const InputDecoration(labelText: 'Medication name (optional)', hintText: 'Correct OCR result here')),
          const SizedBox(height: 14),
          const TextField(decoration: InputDecoration(labelText: 'Prescriber or clinic (optional)')),
          const SizedBox(height: 24),
          ElevatedButton(onPressed: _saving || !_uploaded ? null : _save, child: Text(_saving ? 'Uploading…' : 'Submit for review')),
          const SizedBox(height: 14),
          const Text('Do not upload a prescription belonging to another person. Clinical records are protected by Kenyan health-data law.', style: TextStyle(fontSize: 12, color: Colors.black54)),
        ],
      ),
    );
  }

  void _selectFile() {
    setState(() => _uploaded = true);
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    await Future<void>.delayed(const Duration(milliseconds: 500));
    if (!mounted) return;
    setState(() => _saving = false);
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Prescription submitted for pharmacist review.')));
    Navigator.pop(context);
  }
}

class _Icon extends StatelessWidget {
  const _Icon(this.selected);
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Icon(selected ? Icons.check_circle : Icons.cloud_upload_outlined, size: 52, color: selected ? Colors.green : Theme.of(context).colorScheme.primary);
  }
}
