import 'package:flutter/material.dart';
import '../../../shared/models/consultation.dart';

class VideoCallScreen extends StatefulWidget {
  const VideoCallScreen({super.key, required this.consultation});

  final Consultation consultation;

  @override
  State<VideoCallScreen> createState() => _VideoCallScreenState();
}

class _VideoCallScreenState extends State<VideoCallScreen> {
  bool _muted = false;
  bool _camera = true;
  bool _chat = false;
  bool _connected = false;

  @override
  void initState() {
    super.initState();
    Future<void>.delayed(const Duration(milliseconds: 700), () {
      if (mounted) setState(() => _connected = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(widget.consultation.provider),
        actions: [IconButton(onPressed: () {}, icon: const Icon(Icons.more_vert))],
      ),
      body: Column(
        children: [
          Expanded(
            child: Stack(
              fit: StackFit.expand,
              children: [
                Container(color: const Color(0xFF1F2937), child: const Icon(Icons.person_outline, size: 150, color: Colors.white24)),
                Positioned(top: 16, left: 16, child: Chip(avatar: Icon(Icons.signal_cellular_alt, color: _connected ? Colors.green : Colors.orange, size: 16), label: Text(_connected ? 'Good connection' : 'Connecting…'))),
                Positioned(top: 16, right: 16, child: Container(width: 110, height: 150, color: const Color(0xFF374151), child: Icon(_camera ? Icons.person : Icons.videocam_off, color: Colors.white70, size: 44))),
              ],
            ),
          ),
          if (_chat) const _ChatPanel(),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _CallButton(icon: _muted ? Icons.mic_off : Icons.mic, label: 'Mute', active: _muted, onTap: () => setState(() => _muted = !_muted)),
                  _CallButton(icon: _camera ? Icons.videocam : Icons.videocam_off, label: 'Camera', active: !_camera, onTap: () => setState(() => _camera = !_camera)),
                  _CallButton(icon: Icons.chat_bubble_outline, label: 'Chat', active: _chat, onTap: () => setState(() => _chat = !_chat)),
                  _CallButton(icon: Icons.call_end, label: 'End', color: Colors.red, onTap: () => Navigator.pop(context)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CallButton extends StatelessWidget {
  const _CallButton({required this.icon, required this.label, required this.active, required this.onTap, this.color});
  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final buttonColor = color ?? (active ? Colors.white : Colors.white24);
    return Column(children: [InkWell(onTap: onTap, borderRadius: BorderRadius.circular(30), child: CircleAvatar(radius: 28, backgroundColor: buttonColor, child: Icon(icon, color: color == null ? Colors.white : Colors.white)), const SizedBox(height: 5), Text(label, style: const TextStyle(color: Colors.white70, fontSize: 11))]);
  }
}

class _ChatPanel extends StatelessWidget {
  const _ChatPanel();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 150,
      padding: const EdgeInsets.all(16),
      color: Colors.white,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Care chat', style: TextStyle(fontWeight: FontWeight.w800)),
        const Spacer(),
        const Text('Messages are part of your clinical record.'),
        const SizedBox(height: 8),
        TextField(decoration: InputDecoration(hintText: 'Write a message', suffixIcon: IconButton(onPressed: () {}, icon: const Icon(Icons.send))))]),
    ));
  }
}
