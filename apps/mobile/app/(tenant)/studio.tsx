import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { getProfile, listExperts, listServices, updateExpert, updateService } from '@/api/tenant';
import { useAuth } from '@/auth/AuthProvider';
import { SwitchRow } from '@/components/controls';
import { Badge, KeyValue, ListRow, Note } from '@/components/display';
import {
  Card,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  Screen,
  ScreenHeader,
  ScreenScroll,
  SectionCard,
} from '@/components/layout';
import { messageFor } from '@/lib/errors';
import { formatMoney, tenantStatusTone, titleCase } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { colors, spacing, typography } from '@/theme';

export default function StudioScreen() {
  const auth = useAuth();
  const tenant = auth.activeTenant;
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const data = useAsync(async () => {
    if (!tenant) {
      throw new Error('No studio selected');
    }
    const [profile, services, experts] = await Promise.all([
      getProfile(tenant.tenantId),
      listServices(tenant.tenantId),
      listExperts(tenant.tenantId),
    ]);
    return { profile, services, experts };
  }, [tenant?.tenantId]);

  if (!tenant) {
    return (
      <Screen>
        <View style={styles.center}>
          <ErrorBlock message="No studio membership was found for this account." onRetry={auth.refresh} />
        </View>
      </Screen>
    );
  }

  async function toggleService(serviceId: string, field: 'isActive' | 'isPublic', value: boolean) {
    setBusyKey(`service:${serviceId}`);
    setError(null);
    try {
      await updateService(tenant!.tenantId, serviceId, { [field]: value });
      data.refresh();
    } catch (caught) {
      setError(messageFor(caught, 'Could not update the service.'));
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleExpert(expertId: string, value: boolean) {
    setBusyKey(`expert:${expertId}`);
    setError(null);
    try {
      await updateExpert(tenant!.tenantId, expertId, { isActive: value });
      data.refresh();
    } catch (caught) {
      setError(messageFor(caught, 'Could not update the expert.'));
    } finally {
      setBusyKey(null);
    }
  }

  const profile = data.data?.profile;
  const services = data.data?.services ?? [];
  const experts = data.data?.experts ?? [];

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
        <ScreenHeader
          eyebrow="Studio"
          title="Your operation"
          subtitle="Profile, service visibility, and the experts customers can book."
        />

        {data.loading && !data.data ? <LoadingBlock label="Loading studio settings…" /> : null}
        {data.error ? <ErrorBlock message={data.error} onRetry={data.refresh} /> : null}
        {error ? <Note tone="error">{error}</Note> : null}

        {profile ? (
          <SectionCard
            title="Profile"
            action={<Badge label={titleCase(profile.status)} tone={tenantStatusTone(profile.status)} dot />}
          >
            <View style={styles.profileHead}>
              <Text style={styles.profileName}>{profile.name}</Text>
              <Text style={styles.profileSlug}>neara/{profile.slug}</Text>
            </View>
            <KeyValue label="Category" value={profile.primaryCategory?.name} />
            <KeyValue label="Timezone" value={profile.timezone} />
            <KeyValue label="Public email" value={profile.publicEmail} />
            <KeyValue label="Public phone" value={profile.publicPhone} />
            <KeyValue label="Booking prefix" value={profile.bookingPrefix} />
            <Note tone="neutral">
              Profile fields and locations are edited in the Neara web console. This app covers the
              bookings and availability controls used day to day.
            </Note>
          </SectionCard>
        ) : null}

        <SectionCard title="Services" subtitle="Customers only see active and public services.">
          {services.length === 0 ? (
            <EmptyState
              icon="pricetags-outline"
              title="No services yet"
              body="Add a service from the web console before the studio can be activated."
            />
          ) : (
            <View style={styles.list}>
              {services.map((service) => {
                const price = formatMoney(service.displayPriceAmount, service.displayPriceCurrency);
                const disabled = busyKey !== null;
                return (
                  <View key={service.id} style={styles.serviceCard}>
                    <View style={styles.serviceHead}>
                      <View style={styles.flex}>
                        <Text style={styles.serviceName}>{service.name}</Text>
                        <Text style={styles.serviceMeta}>
                          {service.durationMinutes} min{price ? ` · ${price}` : ''}
                        </Text>
                      </View>
                      <Badge
                        label={service.isPublic ? 'Public' : 'Hidden'}
                        tone={service.isPublic ? 'teal' : 'neutral'}
                      />
                    </View>
                    <SwitchRow
                      title="Active"
                      subtitle="Bookable by the studio"
                      value={service.isActive}
                      disabled={disabled}
                      onValueChange={(value) => void toggleService(service.id, 'isActive', value)}
                    />
                    <SwitchRow
                      title="Public"
                      subtitle="Visible in discovery and direct pages"
                      value={service.isPublic}
                      disabled={disabled}
                      onValueChange={(value) => void toggleService(service.id, 'isPublic', value)}
                    />
                  </View>
                );
              })}
            </View>
          )}
        </SectionCard>

        <SectionCard title="Experts" subtitle="Profiles customers can book. Experts do not sign in.">
          {experts.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="No experts yet"
              body="Add an expert and assign services from the web console."
            />
          ) : (
            <View style={styles.list}>
              {experts.map((expert) => (
                <View key={expert.id} style={styles.expertCard}>
                  <ListRow
                    icon="person-outline"
                    title={expert.displayName}
                    subtitle={
                      expert.expertServices.length > 0
                        ? expert.expertServices.map((assignment) => assignment.service.name).join(', ')
                        : 'No services assigned'
                    }
                    badge={
                      <Badge
                        label={expert.isActive ? 'Active' : 'Inactive'}
                        tone={expert.isActive ? 'success' : 'neutral'}
                        dot
                      />
                    }
                  />
                  <SwitchRow
                    title="Accepting bookings"
                    value={expert.isActive}
                    disabled={busyKey !== null}
                    onValueChange={(value) => void toggleExpert(expert.id, value)}
                  />
                </View>
              ))}
            </View>
          )}
        </SectionCard>

        <Card style={styles.securityNote}>
          <View style={styles.securityHead}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.teal} />
            <Text style={styles.securityTitle}>Server-checked permissions</Text>
          </View>
          <Text style={styles.securityBody}>
            Every change here is authorized against your studio membership by the API and written to
            the audit log. The app never sends a studio ID you can edit.
          </Text>
        </Card>
      </ScreenScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  profileHead: { gap: 2, marginBottom: spacing.sm },
  profileName: { ...typography.subtitle, color: colors.ink },
  profileSlug: { ...typography.small, color: colors.muted },
  list: { gap: spacing.md },
  serviceCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: colors.surfaceStrong,
  },
  serviceHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  serviceName: { ...typography.bodyStrong, color: colors.ink },
  serviceMeta: { ...typography.small, color: colors.muted },
  expertCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    backgroundColor: colors.surfaceStrong,
  },
  securityNote: { gap: spacing.sm },
  securityHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  securityTitle: { ...typography.bodyStrong, color: colors.ink },
  securityBody: { ...typography.small, color: colors.muted },
});
