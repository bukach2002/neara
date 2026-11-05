import { Ionicons } from '@expo/vector-icons';
import { Link, Redirect } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { BrandMark, Note } from '@/components/display';
import { Button, PasswordField, TextField } from '@/components/controls';
import { Card, Screen, ScreenScroll } from '@/components/layout';
import { messageFor } from '@/lib/errors';
import { colors, radius, spacing, typography } from '@/theme';

export default function SignInScreen() {
  const auth = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (auth.status === 'authenticated' && auth.role) {
    return <Redirect href={auth.goHome(auth.role)} />;
  }

  async function submit() {
    setError(null);
    if (!identifier.trim() || !password) {
      setError('Enter your email or mobile number and password.');
      return;
    }

    setBusy(true);
    try {
      await auth.signIn(identifier, password);
    } catch (caught) {
      setError(messageFor(caught, 'Sign in failed. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScreenScroll contentStyle={styles.content}>
          <View style={styles.brandRow}>
            <BrandMark />
          </View>

          <View style={styles.head}>
            <Text style={styles.eyebrow}>One app, three workspaces</Text>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.body}>
              Sign in with your customer, studio, or platform admin account. Neara opens the right
              workspace for you.
            </Text>
          </View>

          <Card style={styles.card}>
            <TextField
              label="Email or mobile number"
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoComplete="username"
              returnKeyType="next"
            />
            <PasswordField value={password} onChangeText={setPassword} />

            <Button label="Sign in" onPress={submit} loading={busy} icon="lock-closed-outline" />

            <View style={styles.links}>
              <Link href="/forgot-password" asChild>
                <Pressable accessibilityRole="link" hitSlop={8}>
                  <Text style={styles.link}>Forgot password?</Text>
                </Pressable>
              </Link>
              <Link href="/register" asChild>
                <Pressable accessibilityRole="link" hitSlop={8}>
                  <Text style={styles.link}>Create an account</Text>
                </Pressable>
              </Link>
            </View>

            {error ? <Note tone="error">{error}</Note> : null}
          </Card>

          <View style={styles.assurance}>
            <Ionicons name="shield-checkmark-outline" size={19} color={colors.teal} />
            <Text style={styles.assuranceText}>
              Your session is held in this device&apos;s encrypted keystore, never in plain storage.
              Neara never asks for card details.
            </Text>
          </View>

          <View style={styles.roles}>
            <RoleHint icon="compass-outline" title="Customers" body="Discover studios and book confirmed slots." />
            <RoleHint icon="storefront-outline" title="Studio teams" body="Run today's bookings, services, and team." />
            <RoleHint icon="shield-half-outline" title="Platform admins" body="Manage tenants, categories, and logs." />
          </View>

          <Text style={styles.footnote}>
            Studio and platform admins use their admin email here. Admin password resets are
            completed in the Neara web console.
          </Text>
        </ScreenScroll>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function RoleHint({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.roleHint}>
      <View style={styles.roleIcon}>
        <Ionicons name={icon} size={17} color={colors.accent} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.roleTitle}>{title}</Text>
        <Text style={styles.roleBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingTop: spacing.md, gap: spacing.xl },
  brandRow: { paddingVertical: spacing.sm },
  head: { gap: spacing.sm },
  eyebrow: { ...typography.eyebrow, color: colors.teal, textTransform: 'uppercase' },
  title: { ...typography.display, color: colors.ink },
  body: { ...typography.body, color: colors.muted },
  card: { gap: spacing.lg },
  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
  link: { ...typography.smallStrong, color: colors.accent },
  assurance: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.tealSoft,
    borderWidth: 1,
    borderColor: '#c4e9e4',
  },
  assuranceText: { ...typography.small, color: '#0b5f57', flex: 1 },
  roles: { gap: spacing.md },
  roleHint: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  roleIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleTitle: { ...typography.bodyStrong, color: colors.ink },
  roleBody: { ...typography.small, color: colors.muted },
  footnote: { ...typography.small, color: colors.muted, fontSize: 12, paddingBottom: spacing.lg },
});
