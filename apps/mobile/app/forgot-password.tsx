import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { confirmPasswordReset, requestPasswordResetOtp } from '@/api/auth';
import { messageFor } from '@/lib/errors';
import { Button, PasswordField, TextField } from '@/components/controls';
import { BrandMark, Note } from '@/components/display';
import { Card, Screen, ScreenScroll } from '@/components/layout';
import { colors, spacing, typography } from '@/theme';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [stage, setStage] = useState<'request' | 'confirm' | 'done'>('request');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode() {
    setError(null);
    if (!EMAIL_PATTERN.test(identifier.trim())) {
      setError('Enter the email address on your account. Codes are sent by email only.');
      return;
    }
    setBusy(true);
    try {
      await requestPasswordResetOtp(identifier);
      setStage('confirm');
    } catch (caught) {
      setError(messageFor(caught, 'We could not send a code right now.'));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    setError(null);
    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Enter the six-digit code from your email.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Use at least 8 characters for the new password.');
      return;
    }
    if (newPassword !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      await confirmPasswordReset({ identifier: identifier.trim(), otp: otp.trim(), newPassword });
      setStage('done');
    } catch (caught) {
      setError(messageFor(caught, 'That code is invalid or has expired. Request a new one.'));
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
                <Text style={styles.link}>Back to sign in</Text>
              </Pressable>
            </Link>
          </View>

          <View style={styles.head}>
            <Text style={styles.eyebrow}>Account recovery</Text>
            <Text style={styles.title}>Reset your password</Text>
            <Text style={styles.body}>
              We email a single-use six-digit code. Nothing changes until you confirm it.
            </Text>
          </View>

          {stage === 'request' ? (
            <Card style={styles.card}>
              <TextField
                label="Account email"
                value={identifier}
                onChangeText={setIdentifier}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoComplete="email"
              />
              <Button label="Email me a code" onPress={requestCode} loading={busy} icon="mail-outline" />
              {error ? <Note tone="error">{error}</Note> : null}
              <Note tone="neutral">
                If that email exists, a code arrives shortly. Admin password resets are completed in
                the Neara web console.
              </Note>
            </Card>
          ) : null}

          {stage === 'confirm' ? (
            <Card style={styles.card}>
              <View style={styles.codeHead}>
                <Ionicons name="mail-open-outline" size={19} color={colors.accent} />
                <Text style={styles.codeText}>
                  Code sent to <Text style={styles.codeEmail}>{identifier.trim()}</Text>
                </Text>
              </View>
              <TextField
                label="Six-digit code"
                value={otp}
                onChangeText={setOtp}
                placeholder="123456"
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
              />
              <PasswordField
                label="New password"
                value={newPassword}
                onChangeText={setNewPassword}
                autoComplete="new-password"
              />
              <PasswordField
                label="Confirm new password"
                value={confirm}
                onChangeText={setConfirm}
                autoComplete="new-password"
              />
              <Button label="Update password" onPress={resetPassword} loading={busy} />
              <Button
                label="Send a new code"
                variant="ghost"
                compact
                onPress={() => {
                  setStage('request');
                  setError(null);
                }}
              />
              {error ? <Note tone="error">{error}</Note> : null}
            </Card>
          ) : null}

          {stage === 'done' ? (
            <Card style={styles.card}>
              <Note tone="success">
                Password updated. Every existing customer session for this account has been signed
                out by the server.
              </Note>
              <Button label="Go to sign in" onPress={() => router.replace('/sign-in')} />
            </Card>
          ) : null}
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
  codeHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  codeText: { ...typography.small, color: colors.muted, flex: 1 },
  codeEmail: { ...typography.smallStrong, color: colors.ink },
});
