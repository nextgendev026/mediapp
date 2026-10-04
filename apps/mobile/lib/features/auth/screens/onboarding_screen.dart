import 'package:flutter/material.dart';

class OnboardingScreen extends StatelessWidget {
  const OnboardingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Spacer(),
              Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(color: Theme.of(context).colorScheme.primary, borderRadius: BorderRadius.circular(24)),
                child: const Icon(Icons.local_hospital, color: Colors.white, size: 48),
              ),
              const SizedBox(height: 28),
              Text('Your health, delivered', style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 12),
              const Text('Consult doctors, order medicines, and track delivery from one secure app.'),
              const Spacer(),
              const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [Icon(Icons.circle, size: 10), SizedBox(width: 8), Icon(Icons.circle, size: 10), SizedBox(width: 8), Icon(Icons.circle, size: 10)],
              ),
              const SizedBox(height: 24),
              ElevatedButton(onPressed: () => Navigator.of(context).maybePop(), child: const Text('Get started')),
            ],
          ),
        ),
      ),
    );
  }
}
