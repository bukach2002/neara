import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { listSessions, revokeSession } from '@/api/auth';
import { useAuth } from '@/auth/AuthProvider';
import { Button, IconButton } from '@/components/controls';
import { Badge, Note } from '@/components/display';
import {
  Card,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  Screen,
  ScreenScroll,
  SectionCard,
} from '@/components/layout';
import { messageFor } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { colors, spacing, typography } from '@/theme';
import type { SessionInfo } from '@/types';

function deviceLabel(session: SessionInfo) {
  if (session.deviceName) return session.deviceName;
  if (session.kind === 'mobile') return 'Neara mobile app';
  return 'Web browser';
}

export default function SessionsScreen() {
  const router = useRouter();
  const auth = useAuth();
  const sessions = useAsync(listSessions, []);
  const [removed, setRemoved] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const items = (sessions.data ?? []).filter((item) => !removed.includes(item.id));

  async function revoke(session: SessionInfo) {
    if (session.current) return;
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Sign this device out?',
        `${deviceLabel(session)} will need your password and one-time code to sign in again.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Sign out', style: 'destructive', onPress: () => resolve(true) },
        ],
      );
    });
    if (!confirmed) return;

    setBusy(session.id);
    setNote(null);
    try {
      await revokeSession(session.id);
      setRemoved((current) => [...current, session.id]);
      setNote({ tone: 'success', text: `${deviceLabel(session)} signed out.` });
    } catch (error) {
      setNote({ tone: 'error', text: messageFor(error, 'We could not sign that device out. Try again.') });
    } finally {
      setBusy(null);
    }
  }

  function confirmSignOutEverywhere() {
    Alert.alert(
      'Sign out everywhere?',
      'This phone and every other browser or device will need to sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out everywhere',
          style: 'destructive',
          onPress: () => {
            setBusy('all');
            setNote(null);
            auth
              .signOutEverywhere()
              .catch((error: unknown) =>
                setNote({ tone: 'error', text: messageFor(error, 'We could not sign you out everywhere.') }),
              )
              .finally(() => setBusy(null));
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <View style={styles.topBar}>
        <IconButton icon="arrow-back" label="Back" onPress={() => router.back()} />
        <Text style={styles.topBarTitle}>Devices</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScreenScroll
        contentStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={sessions.loading && Boolean(sessions.data)}
            onRefresh={sessions.refresh}
            tintColor={colors.accent}
          />
        }
      >
        <SectionCard
          title="Signed-in devices"
          subtitle="Every browser and phone that can open your account."
        >
          {sessions.loading && !sessions.data ? <LoadingBlock label="Loading devices…" /> : null}
          {sessions.error && !sessions.data ? <ErrorBlock message={sessions.error} onRetry={sessions.refresh} /> : null}

          {items.map((session) => (
            <Card key={session.id} style={styles.row}>
              <View style={styles.rowHead}>
                <Ionicons
                  name={session.kind === 'mobile' ? 'phone-portrait-outline' : 'laptop-outline'}
                  size={18}
                  color={colors.muted}
                />
                <View style={styles.flex}>
                  <View style={styles.titleRow}>
                    <Text style={styles.title}>{deviceLabel(session)}</Text>
                    {session.current ? <Badge label="This device" tone="teal" dot /> : null}
                    {session.kind === 'web' ? <Badge label="Web" tone="neutral" /> : null}
                  </View>
                  <Text style={styles.meta}>
                    {[session.platform, session.trustedDevice ? 'Trusted' : null].filter(Boolean).join(' · ') ||
                      'Neara account'}
                  </Text>
                  <Text style={styles.meta}>
                    Last used {formatDateTime(session.lastUsedAt ?? session.createdAt)} · Expires{' '}
                    {formatDateTime(session.expiresAt)}
                  </Text>
                </View>
              </View>
              {session.current ? null : (
                <Button
                  label="Sign out"
                  variant="secondary"
                  icon="log-out-outline"
                  loading={busy === session.id}
                  disabled={busy !== null}
                  onPress={() => void revoke(session)}
                />
              )}
            </Card>
          ))}

          {sessions.data && items.length === 0 ? (
            <EmptyState icon="shield-checkmark-outline" title="No other devices" body="Only this device is signed in." />
          ) : null}

          {note ? <Note tone={note.tone}>{note.text}</Note> : null}
        </SectionCard>

        <SectionCard title="Lost a device?">
          <Text style={styles.body}>
            Signing out everywhere revokes the session on this phone immediately. Sign back in here with your
            password and one-time code.
          </Text>
          <Button
            label="Sign out everywhere"
            variant="danger"
            icon="log-out-outline"
            loading={busy === 'all'}
            disabled={busy !== null}
            onPress={confirmSignOutEverywhere}
          />
        </SectionCard>

        <Text style={styles.footnote}>
          Access tokens last 15 minutes and are refreshed securely on this device. Changing your password
          signs out every device.
        </Text>
      </ScreenScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  topBarTitle: { ...typography.subtitle, color: colors.ink, flex: 1, textAlign: 'center' },
  topBarSpacer: { width: 36 },
  row: { gap: spacing.md },
  rowHead: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  title: { ...typography.bodyStrong, color: colors.ink },
  meta: { ...typography.small, color: colors.muted },
  body: { ...typography.body, color: colors.muted },
  footnote: { ...typography.small, color: colors.muted, paddingHorizontal: spacing.xs },
});
