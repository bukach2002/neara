import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/controls';
import { Avatar, Badge, BrandMark, ListRow, Note } from '@/components/display';
import { Card, Screen, ScreenScroll, SectionCard, SectionTitle } from '@/components/layout';
import { messageFor } from '@/lib/errors';
import { openExternal, PRIVACY_URL, SUPPORT_EMAIL, SUPPORT_URL, TERMS_URL } from '@/lib/links';
import { colors, radius, spacing, typography } from '@/theme';

export default function AccountScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState<'signout' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const user = auth.user;

  async function signOut() {
    setBusy('signout');
    setError(null);
    try {
      await auth.signOut();
    } catch (caught) {
      setError(messageFor(caught, 'Sign out failed. Try again.'));
    } finally {
      setBusy(null);
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Delete your Neara account?',
      'Your login details are permanently removed and this device is signed out. Existing bookings stay with the studio for its records.',
      [
        { text: 'Keep account', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => {
            setBusy('delete');
            setError(null);
            auth
              .deleteAccount()
              .catch((caught: unknown) =>
                setError(messageFor(caught, 'We could not delete the account. Try again.')),
              )
              .finally(() => setBusy(null));
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <ScreenScroll>
        <View style={styles.brandRow}>
          <BrandMark />
        </View>

        <View style={styles.identity}>
          <Avatar name={user?.name ?? 'Neara'} size={64} />
          <View style={styles.identityBody}>
            <Text style={styles.eyebrow}>Neara account</Text>
            <Text style={styles.name}>{user?.name ?? 'Signed in'}</Text>
            <Badge label="Customer" tone="teal" dot />
          </View>
        </View>

        <Card style={styles.contactCard}>
          <ContactRow icon="mail-outline" label="Email" value={user?.email} />
          <ContactRow icon="call-outline" label="Mobile" value={user?.mobileNumber} />
          <Text style={styles.contactHint}>
            Contact details on a booking are matched against this account by the server.
          </Text>
        </Card>

        <SectionCard title="Shortcuts">
          <ListRow
            icon="ticket-outline"
            title="My appointments"
            subtitle="Find a booking by reference and phone"
            onPress={() => router.push('/(customer)/appointments')}
          />
          <ListRow
            icon="compass-outline"
            title="Discover studios"
            subtitle="Search active studios and live slots"
            onPress={() => router.push('/(customer)/discover')}
          />
          <ListRow
            icon="key-outline"
            title="Password and sign-in"
            subtitle="Reset with a one-time email code"
            onPress={() => router.push('/forgot-password')}
          />
        </SectionCard>

        <SectionCard title="Privacy and help">
          <ListRow
            icon="shield-checkmark-outline"
            title="Privacy policy"
            subtitle="What Neara collects and how it is used"
            onPress={() => void openExternal(PRIVACY_URL)}
          />
          <ListRow
            icon="document-text-outline"
            title="Terms of use"
            subtitle="Rules for using Neara"
            onPress={() => void openExternal(TERMS_URL)}
          />
          <ListRow
            icon="help-circle-outline"
            title="Help and support"
            subtitle={SUPPORT_EMAIL}
            onPress={() => void openExternal(SUPPORT_URL)}
          />
        </SectionCard>

        <SectionCard title="Security on this device">
          <View style={styles.securityRow}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.teal} />
            <Text style={styles.securityText}>
              Session cookies live in the Android Keystore or iOS Keychain and are cleared when you
              sign out. The app blocks release builds over plain HTTP.
            </Text>
          </View>
          <View style={styles.securityRow}>
            <Ionicons name="eye-off-outline" size={18} color={colors.teal} />
            <Text style={styles.securityText}>
              Passwords are only sent to the API over HTTPS and are never written to local storage.
            </Text>
          </View>
        </SectionCard>

        <SectionTitle>Account actions</SectionTitle>
        <View style={styles.actions}>
          <Button
            label="Sign out"
            variant="secondary"
            icon="log-out-outline"
            onPress={signOut}
            loading={busy === 'signout'}
            disabled={busy !== null}
          />
          <Button
            label="Delete account"
            variant="danger"
            icon="trash-outline"
            onPress={confirmDelete}
            loading={busy === 'delete'}
            disabled={busy !== null}
          />
        </View>

        {error ? <Note tone="error">{error}</Note> : null}

        <Text style={styles.footnote}>
          Deleting your account removes your login. Contact studios directly to change appointments
          you already made.
        </Text>
      </ScreenScroll>
    </Screen>
  );
}

function ContactRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <View style={styles.contactRow}>
      <View style={styles.contactIcon}>
        <Ionicons name={icon} size={16} color={colors.accent} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.contactLabel}>{label}</Text>
        <Text style={styles.contactValue} selectable>
          {value ?? 'Not provided'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  brandRow: { paddingTop: spacing.sm },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  identityBody: { flex: 1, gap: 4 },
  eyebrow: { ...typography.eyebrow, color: colors.muted, textTransform: 'uppercase' },
  name: { ...typography.display, color: colors.ink },
  contactCard: { gap: spacing.md },
  contactRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  contactIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactLabel: { ...typography.small, color: colors.muted, fontSize: 12 },
  contactValue: { ...typography.bodyStrong, color: colors.ink },
  contactHint: { ...typography.small, color: colors.muted, fontSize: 12 },
  securityRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', paddingVertical: spacing.xs },
  securityText: { ...typography.small, color: colors.muted, flex: 1 },
  actions: { gap: spacing.sm },
  footnote: { ...typography.small, color: colors.muted, fontSize: 12, textAlign: 'center' },
});
