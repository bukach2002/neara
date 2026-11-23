import { useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { listBookings } from '@/api/tenant';
import { useAuth } from '@/auth/AuthProvider';
import { Chip, HorizontalChips, SearchField } from '@/components/controls';
import { Badge, ListRow } from '@/components/display';
import {
  Card,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  Screen,
  ScreenHeader,
  ScreenScroll,
} from '@/components/layout';
import { bookingStatusTone, titleCase } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { colors, spacing, typography } from '@/theme';
import type { BookingStatus } from '@/types';

const FILTERS: Array<{ label: string; value: BookingStatus | undefined }> = [
  { label: 'All', value: undefined },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'No-show', value: 'no_show' },
];

export default function TenantBookingsScreen() {
  const auth = useAuth();
  const router = useRouter();
  const tenant = auth.activeTenant;
  const [status, setStatus] = useState<BookingStatus | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(handle);
  }, [search]);

  const bookings = useAsync(async () => {
    if (!tenant) {
      throw new Error('No studio selected');
    }
    return listBookings(tenant.tenantId, { status, search: debouncedSearch || undefined });
  }, [tenant?.tenantId, status, debouncedSearch]);

  if (!tenant) {
    return (
      <Screen>
        <View style={styles.center}>
          <ErrorBlock message="No studio membership was found for this account." onRetry={auth.refresh} />
        </View>
      </Screen>
    );
  }

  const items = bookings.data?.items ?? [];

  return (
    <Screen>
      <ScreenScroll
        refreshControl={
          <RefreshControl
            refreshing={bookings.loading && Boolean(bookings.data)}
            onRefresh={bookings.refresh}
            tintColor={colors.accent}
          />
        }
      >
        <ScreenHeader
          eyebrow={tenant.tenant.name}
          title="Bookings"
          subtitle="Every confirmed, completed, cancelled, and no-show appointment."
        />

        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Reference, customer, phone, or email"
          onSubmitEditing={() => setDebouncedSearch(search.trim())}
        />

        <HorizontalChips>
          {FILTERS.map((filter) => (
            <Chip
              key={filter.label}
              label={filter.label}
              selected={status === filter.value}
              onPress={() => setStatus(filter.value)}
            />
          ))}
        </HorizontalChips>

        <Text style={styles.count}>
          {bookings.data ? `${bookings.data.total} booking${bookings.data.total === 1 ? '' : 's'}` : ' '}
        </Text>

        {bookings.loading && !bookings.data ? <LoadingBlock label="Loading bookings…" /> : null}
        {bookings.error ? <ErrorBlock message={bookings.error} onRetry={bookings.refresh} /> : null}

        {!bookings.loading && !bookings.error && items.length === 0 ? (
          <Card>
            <EmptyState
              icon="calendar-outline"
              title="No bookings in this view"
              body={status ? 'Try another status or clear the search.' : 'New bookings appear here as soon as customers confirm them.'}
            />
          </Card>
        ) : null}

        <View style={styles.list}>
          {items.map((booking) => (
            <Card key={booking.id} padded={false} style={styles.rowCard}>
              <ListRow
                title={`${booking.bookingReference} · ${booking.customerNameSnapshot}`}
                subtitle={`${booking.serviceNameSnapshot} with ${booking.expertDisplayNameSnapshot}`}
                meta={booking.displayTimeSnapshot}
                badge={
                  <Badge
                    label={titleCase(booking.status)}
                    tone={bookingStatusTone(booking.status)}
                    dot
                  />
                }
                onPress={() =>
                  router.push({ pathname: '/(tenant)/bookings/[id]', params: { id: booking.id } })
                }
              />
            </Card>
          ))}
        </View>
      </ScreenScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  count: { ...typography.small, color: colors.muted },
  list: { gap: spacing.sm },
  rowCard: { paddingHorizontal: spacing.lg },
});
