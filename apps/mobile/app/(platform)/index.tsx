import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { listTenants } from '@/api/platform';
import { useAuth } from '@/auth/AuthProvider';
import { Chip, HorizontalChips, SearchField } from '@/components/controls';
import { Badge, BrandMark, ListRow } from '@/components/display';
import {
  Card,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  Screen,
  ScreenHeader,
  ScreenScroll,
} from '@/components/layout';
import { pluralize, tenantStatusTone, titleCase } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { colors, spacing, typography } from '@/theme';
import type { TenantStatus } from '@/types';

const STATUS_FILTERS: Array<{ label: string; value: TenantStatus | undefined }> = [
  { label: 'All', value: undefined },
  { label: 'Active', value: 'active' },
  { label: 'Draft', value: 'draft' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Suspended', value: 'suspended' },
];

export default function PlatformTenantsScreen() {
  const router = useRouter();
  const auth = useAuth();
  const [status, setStatus] = useState<TenantStatus | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  const tenants = useAsync(() => listTenants(), []);

  const filtered = useMemo(() => {
    return (tenants.data ?? []).filter((tenant) => {
      if (status && tenant.status !== status) {
        return false;
      }
      if (!debouncedSearch) {
        return true;
      }
      return (
        tenant.name.toLowerCase().includes(debouncedSearch) ||
        tenant.slug.toLowerCase().includes(debouncedSearch) ||
        (tenant.primaryCategory?.name ?? '').toLowerCase().includes(debouncedSearch)
      );
    });
  }, [tenants.data, status, debouncedSearch]);

  const counts = useMemo(() => {
    const source = tenants.data ?? [];
    return {
      total: source.length,
      active: source.filter((tenant) => tenant.status === 'active').length,
      draft: source.filter((tenant) => tenant.status === 'draft').length,
    };
  }, [tenants.data]);

  return (
    <Screen>
      <ScreenScroll
        refreshControl={
          <RefreshControl
            refreshing={tenants.loading && Boolean(tenants.data)}
            onRefresh={tenants.refresh}
            tintColor={colors.accent}
          />
        }
      >
        <View style={styles.brandRow}>
          <BrandMark />
          <Badge label="Platform admin" tone="violet" dot />
        </View>

        <ScreenHeader
          eyebrow="Platform"
          title="Tenants"
          subtitle={`${pluralize(counts.total, 'tenant')} · ${counts.active} live · ${counts.draft} in setup`}
        />

        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Search tenants or category"
          onSubmitEditing={() => setDebouncedSearch(search.trim().toLowerCase())}
        />

        <HorizontalChips>
          {STATUS_FILTERS.map((filter) => (
            <Chip
              key={filter.label}
              label={filter.label}
              selected={status === filter.value}
              onPress={() => setStatus(filter.value)}
            />
          ))}
        </HorizontalChips>

        {tenants.loading && !tenants.data ? <LoadingBlock label="Loading tenants…" /> : null}
        {tenants.error ? <ErrorBlock message={tenants.error} onRetry={tenants.refresh} /> : null}

        {!tenants.loading && !tenants.error && filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon="business-outline"
              title="No tenants in this view"
              body="Try a different status or search term."
            />
          </Card>
        ) : null}

        <View style={styles.list}>
          {filtered.map((tenant) => (
            <Card key={tenant.id} padded={false} style={styles.rowCard}>
              <ListRow
                title={tenant.name}
                subtitle={`${tenant.primaryCategory?.name ?? 'No category'} · ${tenant.slug}`}
                meta={`${pluralize(tenant._count.bookings, 'booking')} · ${pluralize(tenant._count.experts, 'expert')} · ${pluralize(tenant._count.services, 'service')}`}
                badge={<Badge label={titleCase(tenant.status)} tone={tenantStatusTone(tenant.status)} dot />}
                onPress={() =>
                  router.push({ pathname: '/(platform)/tenants/[id]', params: { id: tenant.id } })
                }
              />
            </Card>
          ))}
        </View>

        <Text style={styles.footnote}>
          Signed in as {auth.user?.name ?? 'platform admin'}. Every lifecycle action is audited.
        </Text>
      </ScreenScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  list: { gap: spacing.sm },
  rowCard: { paddingHorizontal: spacing.lg },
  footnote: { ...typography.small, color: colors.muted, fontSize: 12, textAlign: 'center' },
});
