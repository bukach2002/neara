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
import { openExternal, PRIVACY_URL, SUPPORT_URL, TERMS_URL } from '@/lib/links';
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
            <Text style={styles.eyebrow}></Text>
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

            <View style={styles.businessRow}>
              <Ionicons name="storefront-outline" size={17} color={colors.teal} />
              <Text style={styles.businessText}>Own a studio?</Text>
              <Link href="/business-signup" asChild>
                <Pressable accessibilityRole="link" hitSlop={8}>
                  <Text style={styles.link}>List your business</Text>
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

          <View style={styles.footerLinks}>
            <Text
              accessibilityRole="link"
              style={styles.footerLink}
              onPress={() => void openExternal(PRIVACY_URL)}
            >
              Privacy
            </Text>
            <Text style={styles.footerDot}>·</Text>
            <Text
              accessibilityRole="link"
              style={styles.footerLink}
              onPress={() => void openExternal(TERMS_URL)}
            >
              Terms
            </Text>
            <Text style={styles.footerDot}>·</Text>
            <Text
              accessibilityRole="link"
              style={styles.footerLink}
              onPress={() => void openExternal(SUPPORT_URL)}
            >
              Help
            </Text>
          </View>
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
  businessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  businessText: { ...typography.small, color: colors.muted },
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
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  footerLink: { ...typography.smallStrong, color: colors.accent },
  footerDot: { ...typography.small, color: colors.lineStrong },
});
