import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { cancelBooking, getBooking } from '@/api/platform';
import { Button, IconButton } from '@/components/controls';
import { Badge, BookingReceipt, Note } from '@/components/display';
import {
  Card,
  ErrorBlock,
  LoadingBlock,
  Screen,
  ScreenScroll,
  SectionCard,
} from '@/components/layout';
import { messageFor } from '@/lib/errors';
import { bookingStatusTone, titleCase } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { colors, spacing, typography } from '@/theme';

export default function PlatformBookingDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const bookingId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const booking = useAsync(() => {
    if (!bookingId) {
      throw new Error('Booking link is incomplete');
    }
    return getBooking(bookingId);
  }, [bookingId]);

  const record = booking.data;

  function confirmCancel() {
    if (!bookingId) {
      return;
    }
    Alert.alert(
      'Cancel this booking?',
      'The customer is notified and the slot is released. This action is audited.',
      [
        { text: 'Back', style: 'cancel' },
        {
          text: 'Cancel booking',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            setError(null);
            setNote(null);
            try {
              const updated = await cancelBooking(bookingId);
              booking.setData(updated);
              setNote('Booking cancelled and the customer notification was queued.');
            } catch (caught) {
              setError(messageFor(caught, 'The booking could not be cancelled.'));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <View style={styles.topBar}>
        <IconButton icon="arrow-back" label="Back to bookings" onPress={() => router.back()} />
        <Text style={styles.topBarTitle}>Booking</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScreenScroll
        contentStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={booking.loading && Boolean(record)}
            onRefresh={booking.refresh}
            tintColor={colors.accent}
          />
        }
      >
        {booking.loading && !record ? <LoadingBlock label="Loading booking…" /> : null}
        {booking.error && !record ? <ErrorBlock message={booking.error} onRetry={booking.refresh} /> : null}

        {record ? (
          <>
            <Card style={styles.receiptCard}>
              <View style={styles.statusHead}>
                <Ionicons name="receipt-outline" size={19} color={colors.muted} />
                <Badge label={titleCase(record.status)} tone={bookingStatusTone(record.status)} dot />
              </View>
              <BookingReceipt booking={record} />
            </Card>

            <SectionCard title="Customer">
              <DetailRow label="Name" value={record.customerNameSnapshot} />
              <DetailRow label="Phone" value={record.customerPhoneSnapshot} />
              <DetailRow label="Email" value={record.customerEmailSnapshot} />
              <DetailRow label="Note" value={record.customerNote} />
            </SectionCard>

            <SectionCard title="Tenant record">
              <DetailRow label="Tenant" value={record.tenantNameSnapshot ?? record.tenant?.name} />
              <DetailRow label="Location" value={record.locationAddressSnapshot} />
              <DetailRow label="Timezone" value={record.timezone} />
              <DetailRow label="Booked at" value={new Date(record.createdAt).toLocaleString()} />
            </SectionCard>

            {note ? <Note tone="success">{note}</Note> : null}
            {error ? <Note tone="error">{error}</Note> : null}

            {record.status === 'confirmed' ? (
              <Card style={styles.actions}>
                <Text style={styles.actionTitle}>Support action</Text>
                <Text style={styles.actionBody}>
                  Only confirmed bookings can be cancelled. Completion and no-show are studio actions.
                </Text>
                <Button
                  label="Cancel booking"
                  variant="danger"
                  icon="close-circle-outline"
                  onPress={confirmCancel}
                  loading={busy}
                  disabled={busy}
                />
              </Card>
            ) : (
              <Note tone="neutral">
                This booking is {titleCase(record.status).toLowerCase()} and cannot be changed here.
              </Note>
            )}
          </>
        ) : null}
      </ScreenScroll>
    </Screen>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} selectable>
        {value ?? 'Not provided'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  receiptCard: { gap: spacing.md },
  statusHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  detailRow: { paddingVertical: 6, gap: 1 },
  detailLabel: { ...typography.small, color: colors.muted, fontSize: 12 },
  detailValue: { ...typography.body, color: colors.ink },
  actions: { gap: spacing.sm },
  actionTitle: { ...typography.subtitle, color: colors.ink },
  actionBody: { ...typography.small, color: colors.muted, marginBottom: spacing.sm },
});
