import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { getDashboard, getOnboarding, getProfile } from '@/api/tenant';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/controls';
import { Badge, BrandMark, ListRow, Note, StatTile } from '@/components/display';
import {
  Card,
  ErrorBlock,
  LoadingBlock,
  Screen,
  ScreenHeader,
  ScreenScroll,
  SectionCard,
  SectionTitle,
} from '@/components/layout';
import { messageFor } from '@/lib/errors';
import { tenantStatusTone, titleCase } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { colors, radius, spacing, typography } from '@/theme';

const STEP_LABELS: Record<string, string> = {
  profile: 'Business profile',
  location: 'Location and address',
  services: 'At least one service',
  team: 'Expert assigned to a service',
  availability: 'Availability published',
};

const STEP_HINTS: Record<string, string> = {
  profile: 'Category and timezone',
  location: 'Active location with locality',
  services: 'Active and public service',
  team: 'Active expert linked to a service',
  availability: 'Recurring working window',
};

export default function TenantHomeScreen() {
  const auth = useAuth();
  const router = useRouter();
  const tenant = auth.activeTenant;
  const [switching, setSwitching] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const data = useAsync(async () => {
    if (!tenant) {
      throw new Error('No studio selected');
    }
    const [dashboard, onboarding, profile] = await Promise.all([
      getDashboard(tenant.tenantId),
      getOnboarding(tenant.tenantId),
      getProfile(tenant.tenantId),
    ]);
    return { dashboard, onboarding, profile };
  }, [tenant?.tenantId]);

  if (!tenant) {
    return (
      <Screen>
        <View style={styles.center}>
          <ErrorBlock
            message="This account has no studio membership. Ask a platform admin to attach your account to a studio."
            onRetry={auth.refresh}
          />
          <Button label="Sign out" variant="secondary" onPress={() => void auth.signOut()} />
        </View>
      </Screen>
    );
  }

  const onboarding = data.data?.onboarding;
  const dashboard = data.data?.dashboard;
  const profile = data.data?.profile;

  return (
    <Screen>
      <ScreenScroll
        refreshControl={
          <RefreshControl
            refreshing={data.loading && Boolean(data.data)}
            onRefresh={data.refresh}
            tintColor={colors.accent}
          />
        }
      >
        <View style={styles.brandRow}>
          <BrandMark />
          <Badge label={titleCase(profile?.status ?? tenant.tenant.status)} tone={tenantStatusTone(profile?.status ?? tenant.tenant.status)} dot />
        </View>

        <ScreenHeader
          eyebrow="Studio workspace"
          title={profile?.name ?? tenant.tenant.name}
          subtitle="Today's operation, live bookings, and the setup items still blocking activation."
        />

        {data.loading && !data.data ? <LoadingBlock label="Opening your studio…" /> : null}
        {data.error ? <ErrorBlock message={data.error} onRetry={data.refresh} /> : null}

        {dashboard ? (
          <View style={styles.statsGrid}>
            <StatTile label="Today" value={dashboard.bookingsToday} hint="All bookings" />
            <StatTile label="Upcoming" value={dashboard.upcomingBookings} hint="Confirmed ahead" />
            <StatTile label="Confirmed" value={dashboard.confirmedBookings} hint="Lifetime" />
            <StatTile label="Cancelled" value={dashboard.cancelledBookings} hint="Lifetime" />
          </View>
        ) : null}

        <View style={styles.quickActions}>
          {onboarding && !onboarding.isActive ? (
            <Button
              label={onboarding.ready ? 'Publish my studio' : 'Finish studio setup'}
              icon="rocket-outline"
              onPress={() => router.push('/(tenant)/setup')}
            />
          ) : null}
          <Button label="Open bookings" icon="calendar-outline" onPress={() => router.push('/(tenant)/bookings')} />
          <Button
            label="Manage studio"
            variant="secondary"
            icon="storefront-outline"
            onPress={() => router.push('/(tenant)/studio')}
          />
        </View>

        {onboarding ? (
          <SectionCard
            title="Activation checklist"
            subtitle={
              onboarding.isActive
                ? 'Your studio is live to customers.'
                : 'Complete every item, then publish your studio from setup.'
            }
            action={
              <Badge
                label={onboarding.isActive ? 'Live' : onboarding.ready ? 'Ready' : 'Incomplete'}
                tone={onboarding.isActive ? 'success' : onboarding.ready ? 'teal' : 'warning'}
              />
            }
          >
            <View style={styles.steps}>
              {Object.entries(onboarding.steps).map(([key, done]) => (
                <View key={key} style={styles.step}>
                  <View style={[styles.stepIcon, done ? styles.stepIconDone : null]}>
                    <Ionicons
                      name={done ? 'checkmark' : 'ellipse-outline'}
                      size={14}
                      color={done ? colors.success : colors.muted}
                    />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.stepLabel}>{STEP_LABELS[key] ?? titleCase(key)}</Text>
                    <Text style={styles.stepHint}>{STEP_HINTS[key] ?? ''}</Text>
                  </View>
                </View>
              ))}
            </View>

            {!onboarding.isActive ? (
              <>
                <Note tone={onboarding.ready ? 'success' : 'warning'}>
                  {onboarding.ready
                    ? 'Everything required is in place. Publish the studio to accept bookings.'
                    : `Still missing: ${onboarding.missing.join('; ')}.`}
                </Note>
                <Button
                  label="Open setup"
                  variant="secondary"
                  icon="list-outline"
                  onPress={() => router.push('/(tenant)/setup')}
                />
              </>
            ) : null}
          </SectionCard>
        ) : null}

        {profile ? (
          <SectionCard title="Studio profile">
            <ListRow
              icon="pricetag-outline"
              title={profile.primaryCategory?.name ?? 'No primary category'}
              subtitle="Primary category"
            />
            <ListRow icon="globe-outline" title={profile.timezone ?? 'Timezone not set'} subtitle="Booking timezone" />
            <ListRow icon="at-outline" title={`neara/${profile.slug}`} subtitle="Public page address" />
            <ListRow
              icon="shield-checkmark-outline"
              title={profile.bookingPrefix}
              subtitle="Booking reference prefix"
            />
          </SectionCard>
        ) : null}

        <SectionCard title="Signed in" subtitle={auth.user?.email ?? auth.user?.name}>
          {auth.memberships.length > 1 ? (
            <>
              <SectionTitle>Switch studio</SectionTitle>
              <View style={styles.switchList}>
                {auth.memberships.map((membership) => {
                  const selected = membership.tenantId === tenant.tenantId;
                  return (
                    <Pressable
                      key={membership.tenantId}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      disabled={switching !== null}
                      onPress={async () => {
                        setSwitchError(null);
                        setSwitching(membership.tenantId);
                        try {
                          await auth.selectTenant(membership.tenantId);
                          data.refresh();
                        } catch (error) {
                          setSwitchError(messageFor(error, 'Could not switch studio.'));
                        } finally {
                          setSwitching(null);
                        }
                      }}
                      style={[styles.switchRow, selected ? styles.switchRowSelected : null]}
                    >
                      <View style={styles.flex}>
                        <Text style={styles.switchName}>{membership.tenant.name}</Text>
                        <Text style={styles.switchRole}>{titleCase(String(membership.role))}</Text>
                      </View>
                      {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.accent} /> : null}
                    </Pressable>
                  );
                })}
              </View>
              {switchError ? <Note tone="error">{switchError}</Note> : null}
            </>
          ) : (
            <Text style={styles.roleLine}>{titleCase(String(tenant.role))} access to this studio</Text>
          )}
          <Button label="Sign out" variant="secondary" icon="log-out-outline" onPress={() => void auth.signOut()} />
        </SectionCard>
      </ScreenScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickActions: { gap: spacing.sm },
  steps: { gap: spacing.md },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  stepIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconDone: { backgroundColor: colors.successSoft },
  stepLabel: { ...typography.bodyStrong, color: colors.ink },
  stepHint: { ...typography.small, color: colors.muted, fontSize: 12 },
  switchList: { gap: spacing.sm, marginBottom: spacing.md },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceStrong,
  },
  switchRowSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  switchName: { ...typography.bodyStrong, color: colors.ink },
  switchRole: { ...typography.small, color: colors.muted },
  roleLine: { ...typography.small, color: colors.muted, marginBottom: spacing.md },
});
