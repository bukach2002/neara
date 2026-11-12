import { useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { listBookings } from '@/api/platform';
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

export default function PlatformBookingsScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<BookingStatus | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(handle);
  }, [search]);

  const bookings = useAsync(
    () => listBookings({ status, search: debouncedSearch || undefined, take: 50 }),
    [status, debouncedSearch],
  );

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
          eyebrow="Platform"
          title="Bookings"
          subtitle="Cross-tenant lookup for support, escalations, and cancellations."
        />

        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Reference, customer, phone, email, tenant"
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

        {bookings.loading && !bookings.data ? <LoadingBlock label="Searching bookings…" /> : null}
        {bookings.error ? <ErrorBlock message={bookings.error} onRetry={bookings.refresh} /> : null}

        {!bookings.loading && !bookings.error && items.length === 0 ? (
          <Card>
            <EmptyState
              icon="search-outline"
              title="No bookings found"
              body="Search by booking reference, customer, phone, email, tenant, service, or expert."
            />
          </Card>
        ) : null}

        <View style={styles.list}>
          {items.map((booking) => (
            <Card key={booking.id} padded={false} style={styles.rowCard}>
              <ListRow
                title={`${booking.bookingReference} · ${booking.customerNameSnapshot}`}
                subtitle={`${booking.tenantNameSnapshot ?? booking.tenant?.name ?? 'Tenant'} · ${booking.serviceNameSnapshot}`}
                meta={booking.displayTimeSnapshot}
                badge={<Badge label={titleCase(booking.status)} tone={bookingStatusTone(booking.status)} dot />}
                onPress={() =>
                  router.push({ pathname: '/(platform)/bookings/[id]', params: { id: booking.id } })
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
  count: { ...typography.small, color: colors.muted },
  list: { gap: spacing.sm },
  rowCard: { paddingHorizontal: spacing.lg },
});
