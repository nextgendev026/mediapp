import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../../app.dart';

class ProofOfDeliveryScreen extends StatefulWidget {
  const ProofOfDeliveryScreen({super.key, required this.controller});

  final RiderController controller;

  @override
  State<ProofOfDeliveryScreen> createState() => _ProofOfDeliveryScreenState();
}

class _ProofOfDeliveryScreenState extends State<ProofOfDeliveryScreen> {
  final _otp = TextEditingController();
  final _picker = ImagePicker();
  File? _photo;
  double? _latitude;
  double? _longitude;
  bool _locating = false;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _captureLocation());
  }

  @override
  void dispose() {
    _otp.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ready = _photo != null && _latitude != null && _otp.text.length == 6;
    return Scaffold(
      appBar: AppBar(title: const Text('Proof of delivery')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                children: [
                  Icon(_photo == null ? Icons.photo_camera_outlined : Icons.check_circle, size: 72, color: _photo == null ? Colors.blueGrey : Colors.green),
                  const SizedBox(height: 12),
                  Text(_photo == null ? 'Capture delivery photo' : 'Delivery photo captured', style: const TextStyle(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 6),
                  const Text('Take a clear photo of the sealed handover or the patient confirming receipt.'),
                  const SizedBox(height: 14),
                  OutlinedButton.icon(
                    onPressed: _submitting ? null : _capture,
                    icon: const Icon(Icons.camera_alt_outlined),
                    label: Text(_photo == null ? 'Open camera' : 'Retake photo'),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _otp,
            keyboardType: TextInputType.number,
            maxLength: 6,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(labelText: 'Patient delivery OTP', counterText: '', helperText: 'Ask the patient for the 6-digit code they received by SMS.'),
          ),
          const SizedBox(height: 8),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(_latitude == null ? Icons.location_on_outlined : Icons.check_circle, color: _latitude == null ? Colors.blueGrey : Colors.green),
            title: const Text('GPS stamp'),
            subtitle: Text(
              _latitude == null
                  ? 'A real GPS reading is required for chain of custody'
                  : 'Captured ${_latitude!.toStringAsFixed(5)}, ${_longitude!.toStringAsFixed(5)}',
            ),
            trailing: TextButton(onPressed: _submitting || _locating ? null : _captureLocation, child: Text(_locating ? 'Locating…' : 'Capture')),
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: ready && !_submitting ? _submit : null,
            child: Text(_submitting ? 'Submitting…' : 'Submit proof of delivery'),
          ),
          const SizedBox(height: 12),
          const Text('A delivery photo, a live GPS reading and the patient OTP are all required before an order can be marked delivered.', style: TextStyle(fontSize: 12, color: Colors.black54)),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: Colors.red)),
          ],
        ],
      ),
    );
  }

  Future<void> _capture() async {
    try {
      final picked = await _picker.pickImage(source: ImageSource.camera, maxWidth: 1600, imageQuality: 80);
      if (picked == null) return;
      if (!mounted) return;
      setState(() {
        _photo = File(picked.path);
        _error = null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'The camera is unavailable on this device.');
    }
  }

  Future<void> _captureLocation() async {
    setState(() => _locating = true);
    final point = await widget.controller.location.getCurrentPosition();
    if (!mounted) return;
    setState(() {
      _locating = false;
      if (point == null) {
        _error = 'We could not read your location. Turn on location services and try again.';
        return;
      }
      _latitude = point.latitude;
      _longitude = point.longitude;
      _error = null;
    });
  }

  Future<void> _submit() async {
    final photo = _photo;
    final order = widget.controller.assigned;
    if (photo == null || order == null || _latitude == null || _longitude == null) return;
    if (!RegExp(r'^\d{6}$').hasMatch(_otp.text)) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final photoUrl = await widget.controller.dispatch.uploadProofPhoto(orderId: order.id, photo: photo);
      final recorded = await widget.controller.submitProof(
        photoUrl: photoUrl,
        otp: _otp.text,
        lat: _latitude!,
        lng: _longitude!,
      );
      if (!mounted) return;
      if (!recorded) {
        setState(() {
          _submitting = false;
          _error = widget.controller.error ?? 'We could not record the delivery proof.';
        });
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Proof submitted. Chain of custody updated.')));
      Navigator.pop(context);
    } catch (failure) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = failure is Exception ? failure.toString() : 'We could not submit the proof.';
      });
    }
  }
}
