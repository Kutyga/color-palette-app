import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../app/theme.dart';

/// Вход по email и паролю (Sign in with Apple / Google — следующий шаг).
class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key});

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _signUp = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final auth = Supabase.instance.client.auth;
    try {
      if (_signUp) {
        final res = await auth.signUp(email: _email.text.trim(), password: _password.text);
        if (res.session == null && mounted) {
          setState(() => _error = 'Мы отправили письмо для подтверждения. Откройте ссылку и войдите.');
        }
      } else {
        await auth.signInWithPassword(email: _email.text.trim(), password: _password.text);
      }
    } on AuthException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.garden;
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(GardenTheme.gutter),
          children: [
            const SizedBox(height: 48),
            Icon(Icons.local_florist_rounded, size: 64, color: c.leaf),
            const SizedBox(height: 16),
            Text('Подоконник', style: context.text.displaySmall, textAlign: TextAlign.center),
            const SizedBox(height: 8),
            Text(
              'Напомним о поливе, подскажем, как ухаживать,\nи покажем, что растёт у других.',
              style: context.text.bodyLarge?.copyWith(color: c.secondaryLabel),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 40),
            TextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              decoration: const InputDecoration(hintText: 'Email'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _password,
              obscureText: true,
              autofillHints: [_signUp ? AutofillHints.newPassword : AutofillHints.password],
              decoration: const InputDecoration(hintText: 'Пароль'),
              onSubmitted: (_) => _submit(),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: TextStyle(color: c.alert)),
            ],
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _busy ? null : _submit,
              child: Text(_signUp ? 'Создать аккаунт' : 'Войти'),
            ),
            TextButton(
              onPressed: () => setState(() => _signUp = !_signUp),
              child: Text(_signUp ? 'Уже есть аккаунт? Войти' : 'Впервые здесь? Регистрация'),
            ),
          ],
        ),
      ),
    );
  }
}
