import 'package:flutter/material.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/colors.dart';
import 'features/auth/providers/auth_provider.dart';
import 'features/auth/screens/login_screen.dart';
import 'features/consultations/screens/appointment_list_screen.dart';
import 'features/home/screens/home_screen.dart';
import 'features/orders/screens/order_list_screen.dart';
import 'features/pharmacy/screens/catalog_screen.dart';
import 'features/profile/screens/profile_screen.dart';

class AfyaCommerceApp extends StatelessWidget {
  const AfyaCommerceApp({super.key, this.controller});

  final AuthProvider? controller;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'AfyaCommerce',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      home: controller == null ? const LoginScreen() : PatientRoot(controller: controller!),
    );
  }
}

class PatientRoot extends StatefulWidget {
  const PatientRoot({super.key, required this.controller});

  final AuthProvider controller;

  @override
  State<PatientRoot> createState() => _PatientRootState();
}

class _PatientRootState extends State<PatientRoot> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.controller,
      builder: (context, _) {
        if (!widget.controller.restored) return const SplashScreen();
        if (!widget.controller.authenticated) return LoginScreen(controller: widget.controller);
        final pages = [
          HomeScreen(controller: widget.controller, onNavigate: _select),
          AppointmentListScreen(controller: widget.controller),
          CatalogScreen(controller: widget.controller),
          OrderListScreen(controller: widget.controller),
          ProfileScreen(controller: widget.controller),
        ];
        return Scaffold(
          body: IndexedStack(index: _index, children: pages),
          bottomNavigationBar: NavigationBar(
            selectedIndex: _index,
            onDestinationSelected: _select,
            destinations: const [
              NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
              NavigationDestination(icon: Icon(Icons.video_call_outlined), selectedIcon: Icon(Icons.video_call), label: 'Consult'),
              NavigationDestination(icon: Icon(Icons.shopping_bag_outlined), selectedIcon: Icon(Icons.shopping_bag), label: 'Pharmacy'),
              NavigationDestination(icon: Icon(Icons.receipt_long_outlined), selectedIcon: Icon(Icons.receipt_long), label: 'Orders'),
              NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
            ],
          ),
        );
      },
    );
  }

  void _select(int index) {
    setState(() => _index = index);
  }
}

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(24)),
              child: const Icon(Icons.local_hospital, color: Colors.white, size: 48),
            ),
            const SizedBox(height: 20),
            Text('AfyaCommerce', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            const Text('Your health, delivered'),
            const SizedBox(height: 28),
            const CircularProgressIndicator(),
          ],
        ),
      ),
    );
  }
}
