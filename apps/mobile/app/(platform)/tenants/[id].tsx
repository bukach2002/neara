import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { getTenant, setTenantStatus } from '@/api/platform';
import { Button, IconButton } from '@/components/controls';
import { Badge, KeyValue, ListRow, Note, StatTile } from '@/components/display';
import {
  Card,
  ErrorBlock,
  LoadingBlock,
  Screen,
  ScreenScroll,
  SectionCard,
} from '@/components/layout';
import { messageFor } from '@/lib/errors';
import { pluralize, tenantStatusTone, titleCase } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { colors, spacing, typography } from '@/theme';
import type { TenantStatus } from '@/types';

type LifecycleAction = 'activate' | 'inactivate' | 'suspend';

const ACTION_COPY: Record<
  LifecycleAction,
  { title: string; message: string; confirm: string; destructive: boolean }
> = {
  activate: {
    title: 'Activate this tenant?',
    message:
      'The studio becomes publicly discoverable and bookable. Activation fails if required services, experts, or availability are missing.',
    confirm: 'Activate',
    destructive: false,
  },
  inactivate: {
    title: 'Deactivate this tenant?',
    message: 'The studio disappears from discovery and public pages. Existing bookings are unchanged.',
    confirm: 'Deactivate',
    destructive: true,
  },
  suspend: {
    title: 'Suspend this tenant?',
    message:
      'Suspension hides the studio immediately. Use it for policy or safety issues; the studio team stays able to sign in.',
    confirm: 'Suspend',
    destructive: true,
  },
};

export default function PlatformTenantDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const tenantId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const [busy, setBusy] = useState<LifecycleAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const tenant = useAsync(() => {
    if (!tenantId) {
      throw new Error('Tenant link is incomplete');
    }
    return getTenant(tenantId);
  }, [tenantId]);

  async function applyAction(action: LifecycleAction) {
    if (!tenantId) {
      return;
    }
    setBusy(action);
    setError(null);
    setNote(null);
    try {
      const updated = await setTenantStatus(tenantId, action);
      tenant.setData(updated);
      setNote(
        action === 'activate'
          ? 'Tenant activated. It is now live to customers.'
          : action === 'inactivate'
            ? 'Tenant deactivated and hidden publicly.'
            : 'Tenant suspended and hidden publicly.',
      );
    } catch (caught) {
      setError(messageFor(caught, 'The tenant status could not be changed.'));
    } finally {
      setBusy(null);
    }
  }

  function confirmAction(action: LifecycleAction) {
    const copy = ACTION_COPY[action];
    Alert.alert(copy.title, copy.message, [
      { text: 'Back', style: 'cancel' },
      {
        text: copy.confirm,
        style: copy.destructive ? 'destructive' : 'default',
        onPress: () => void applyAction(action),
      },
    ]);
  }

  const record = tenant.data;
  const status = (record?.status ?? 'draft') as TenantStatus;

  return (
    <Screen>
      <View style={styles.topBar}>
        <IconButton icon="arrow-back" label="Back to tenants" onPress={() => router.back()} />
        <Text style={styles.topBarTitle}>Tenant</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScreenScroll
        contentStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={tenant.loading && Boolean(record)}
            onRefresh={tenant.refresh}
            tintColor={colors.accent}
          />
        }
      >
        {tenant.loading && !record ? <LoadingBlock label="Loading tenant…" /> : null}
        {tenant.error && !record ? <ErrorBlock message={tenant.error} onRetry={tenant.refresh} /> : null}

        {record ? (
          <>
            <Card style={styles.hero}>
              <View style={styles.heroHead}>
                <View style={styles.flex}>
                  <Text style={styles.name}>{record.name}</Text>
                  <Text style={styles.slug}>neara/{record.slug}</Text>
                </View>
                <Badge label={titleCase(record.status)} tone={tenantStatusTone(record.status)} dot />
              </View>
              <KeyValue label="Category" value={record.primaryCategory?.name} />
              <KeyValue label="Timezone" value={record.timezone} />
              <KeyValue label="Booking prefix" value={record.bookingPrefix} />
              <KeyValue label="Public email" value={record.publicEmail} />
              <KeyValue label="Public phone" value={record.publicPhone} />
              <KeyValue label="Description" value={record.description} />
            </Card>

            <View style={styles.statsGrid}>
              <StatTile label="Bookings" value={record._count.bookings} />
              <StatTile label="Services" value={record._count.services} />
              <StatTile label="Experts" value={record._count.experts} />
              <StatTile label="Team" value={record._count.memberships ?? 0} />
            </View>

            {note ? <Note tone="success">{note}</Note> : null}
            {error ? <Note tone="error">{error}</Note> : null}

            <SectionCard title="Lifecycle" subtitle="Changes are immediate and written to the audit log.">
              <View style={styles.actions}>
                {status !== 'active' ? (
                  <Button
                    label="Activate tenant"
                    icon="checkmark-circle-outline"
                    onPress={() => confirmAction('activate')}
                    loading={busy === 'activate'}
                    disabled={busy !== null}
                  />
                ) : null}
                {status === 'active' ? (
                  <Button
                    label="Deactivate tenant"
                    variant="secondary"
                    icon="pause-circle-outline"
                    onPress={() => confirmAction('inactivate')}
                    loading={busy === 'inactivate'}
                    disabled={busy !== null}
                  />
                ) : null}
                {status !== 'suspended' ? (
                  <Button
                    label="Suspend tenant"
                    variant="danger"
                    icon="ban-outline"
                    onPress={() => confirmAction('suspend')}
                    loading={busy === 'suspend'}
                    disabled={busy !== null}
                  />
                ) : (
                  <Note tone="warning">
                    This tenant is suspended. Activating it restores public visibility.
                  </Note>
                )}
              </View>
            </SectionCard>

            <SectionCard title="Team" subtitle="Accounts with studio access">
              {(record.memberships ?? []).length === 0 ? (
                <Note tone="warning">
                  No studio admin exists yet. Create the first tenant admin from the web console.
                </Note>
              ) : (
                (record.memberships ?? []).map((membership) => (
                  <ListRow
                    key={membership.id}
                    icon="person-circle-outline"
                    title={membership.user.name}
                    subtitle={membership.user.email ?? 'No email'}
                    badge={<Badge label={titleCase(String(membership.role))} tone="neutral" />}
                  />
                ))
              )}
            </SectionCard>

            <SectionCard title="Setup state">
              <ListRow
                icon="location-outline"
                title={pluralize(record.locations?.length ?? 0, 'location')}
                subtitle={record.locations?.[0]?.locality ?? 'No active location'}
              />
              <ListRow
                icon="pricetags-outline"
                title={pluralize(record.services?.length ?? 0, 'service')}
                subtitle={
                  (record.services ?? []).filter((service) => service.isActive && service.isPublic).length +
                  ' public and active'
                }
              />
              <ListRow
                icon="people-outline"
                title={pluralize(record.experts?.length ?? 0, 'expert')}
                subtitle={
                  (record.experts ?? []).filter((expert) => expert.isActive).length + ' accepting bookings'
                }
              />
            </SectionCard>

            <Card style={styles.securityNote}>
              <View style={styles.securityHead}>
                <Ionicons name="shield-half-outline" size={18} color={colors.violet} />
                <Text style={styles.securityTitle}>High-impact surface</Text>
              </View>
              <Text style={styles.securityBody}>
                Platform screens can affect every studio. The API requires a platform_admin session and
                CSRF token for these actions. Add step-up authentication before production use.
              </Text>
            </Card>
          </>
        ) : null}
      </ScreenScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  topBarTitle: { ...typography.smallStrong, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1 },
  topBarSpacer: { width: 38 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: 60, gap: spacing.lg },
  hero: { gap: spacing.sm },
  heroHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.xs },
  name: { ...typography.title, color: colors.ink },
  slug: { ...typography.small, color: colors.muted },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { gap: spacing.sm },
  securityNote: { gap: spacing.sm },
  securityHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  securityTitle: { ...typography.bodyStrong, color: colors.ink },
  securityBody: { ...typography.small, color: colors.muted },
});
