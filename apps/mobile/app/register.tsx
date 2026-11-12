import { Link, Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { Button, PasswordField, TextField } from '@/components/controls';
import { BrandMark, Note } from '@/components/display';
import { Card, Screen, ScreenScroll } from '@/components/layout';
import { messageFor } from '@/lib/errors';
import { colors, spacing, typography } from '@/theme';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_PATTERN = /^\+[1-9]\d{7,14}$/;

export default function RegisterScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (auth.status === 'authenticated' && auth.role) {
    return <Redirect href={auth.goHome(auth.role)} />;
  }

  async function submit() {
    setError(null);

    if (name.trim().length < 2) {
      setError('Enter your full name.');
      return;
    }
    if (!email.trim() && !mobileNumber.trim()) {
      setError('Add an email address or a mobile number so studios can reach you.');
      return;
    }
    if (email.trim() && !EMAIL_PATTERN.test(email.trim())) {
      setError('That email address does not look right.');
      return;
    }
    if (mobileNumber.trim() && !MOBILE_PATTERN.test(mobileNumber.trim())) {
      setError('Use international format for your mobile number, for example +919876543210.');
      return;
    }
    if (password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      await auth.register({
        name: name.trim(),
        email: email.trim() ? email.trim().toLowerCase() : undefined,
        mobileNumber: mobileNumber.trim() || undefined,
        password,
      });
    } catch (caught) {
      setError(messageFor(caught, 'We could not create the account. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScreenScroll contentStyle={styles.content}>
          <View style={styles.topRow}>
            <BrandMark wordmark={false} />
            <Link href="/sign-in" asChild>
              <Pressable accessibilityRole="link" hitSlop={8}>
                <Text style={styles.link}>Sign in</Text>
              </Pressable>
            </Link>
          </View>

          <View style={styles.head}>
            <Text style={styles.eyebrow}>Customer account</Text>
            <Text style={styles.title}>Book without the back-and-forth</Text>
            <Text style={styles.body}>
              Keep one identity for every studio, hold slots, and find your appointments later with
              your booking reference.
            </Text>
          </View>

          <Card style={styles.card}>
            <TextField label="Full name" value={name} onChangeText={setName} placeholder="Asha Menon" autoCapitalize="words" autoComplete="name" />
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoComplete="email"
            />
            <TextField
              label="Mobile number"
              value={mobileNumber}
              onChangeText={setMobileNumber}
              placeholder="+919876543210"
              keyboardType="phone-pad"
              autoComplete="tel"
              hint="Email or mobile is required. Mobile must include the country code."
            />
            <PasswordField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
            <PasswordField
              label="Confirm password"
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Repeat your password"
              autoComplete="new-password"
            />
            <Button label="Create account" onPress={submit} loading={busy} />
            {error ? <Note tone="error">{error}</Note> : null}
            <Text style={styles.legal}>
              By creating an account you agree to receive booking-related messages from studios you
              book with. Neara does not collect payment details.
            </Text>
          </Card>

          <Button
            label="Back to sign in"
            variant="ghost"
            onPress={() => router.replace('/sign-in')}
          />
        </ScreenScroll>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: spacing.xl },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm },
  link: { ...typography.smallStrong, color: colors.accent },
  head: { gap: spacing.sm },
  eyebrow: { ...typography.eyebrow, color: colors.teal, textTransform: 'uppercase' },
  title: { ...typography.display, color: colors.ink },
  body: { ...typography.body, color: colors.muted },
  card: { gap: spacing.lg },
  legal: { ...typography.small, color: colors.muted, fontSize: 12 },
});
