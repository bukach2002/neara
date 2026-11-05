import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { cancelBooking, completeBooking, getBooking, markNoShow } from '@/api/tenant';
import { useAuth } from '@/auth/AuthProvider';
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
import type { BookingRecord } from '@/types';

type Action = 'cancel' | 'complete' | 'no_show';

export default function TenantBookingDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const bookingId = Array.isArray(params.id) ? params.id[0] : params.id;
  const auth = useAuth();
  const router = useRouter();
  const tenant = auth.activeTenant;

  const [busyAction, setBusyAction] = useState<Action | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState<string | null>(null);

  const booking = useAsync(async () => {
    if (!tenant || !bookingId) {
      throw new Error('Booking not available');
    }
    return getBooking(tenant.tenantId, bookingId);
  }, [tenant?.tenantId, bookingId]);

  if (!tenant || !bookingId) {
    return (
      <Screen>
        <View style={styles.center}>
          <ErrorBlock message="That booking link is incomplete." onRetry={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const record: BookingRecord | null = booking.data;

  async function applyAction(action: Action) {
    if (!record) {
      return;
    }
    setActionError(null);
    setActionNote(null);
    setBusyAction(action);
    try {
      const updated =
        action === 'cancel'
          ? await cancelBooking(tenant!.tenantId, record.id)
          : action === 'complete'
            ? await completeBooking(tenant!.tenantId, record.id)
            : await markNoShow(tenant!.tenantId, record.id);
      booking.setData(updated);
      setActionNote(
        action === 'cancel'
          ? 'Booking cancelled. The customer is notified by email when an address is on file.'
          : action === 'complete'
            ? 'Marked as completed.'
            : 'Marked as a no-show.',
      );
    } catch (caught) {
      setActionError(messageFor(caught, 'The booking could not be updated.'));
    } finally {
      setBusyAction(null);
    }
  }

  function confirmAction(action: Action) {
    const copy: Record<Action, { title: string; message: string; confirm: string }> = {
      cancel: {
        title: 'Cancel this booking?',
        message: 'The slot is released immediately and the customer is notified. This cannot be undone.',
        confirm: 'Cancel booking',
      },
      complete: {
        title: 'Mark as completed?',
        message: 'Use this after the appointment has happened. The status is final.',
        confirm: 'Mark completed',
      },
      no_show: {
        title: 'Mark as no-show?',
        message: 'Use this when the customer did not attend. The status is final.',
        confirm: 'Mark no-show',
      },
    };
    const { title, message, confirm } = copy[action];
    Alert.alert(title, message, [
      { text: 'Back', style: 'cancel' },
      { text: confirm, style: action === 'cancel' ? 'destructive' : 'default', onPress: () => void applyAction(action) },
    ]);
  }

  return (
    <Screen>
      <View style={styles.topBar}>
        <IconButton icon="arrow-back" label="Back" onPress={() => router.back()} />
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

            <SectionCard title="Customer" subtitle="Contact details captured with the booking">
              <DetailRow icon="person-outline" label="Name" value={record.customerNameSnapshot} />
              <DetailRow icon="call-outline" label="Phone" value={record.customerPhoneSnapshot} />
              <DetailRow icon="mail-outline" label="Email" value={record.customerEmailSnapshot} />
              <DetailRow icon="chatbubble-ellipses-outline" label="Note" value={record.customerNote} />
            </SectionCard>

            <SectionCard title="Booking record">
              <DetailRow icon="time-outline" label="Starts" value={record.displayTimeSnapshot} />
              <DetailRow icon="hourglass-outline" label="Duration" value={`${record.serviceDurationSnapshot} minutes`} />
              <DetailRow icon="location-outline" label="Location" value={record.locationAddressSnapshot} />
              <DetailRow icon="pricetag-outline" label="Reference" value={record.bookingReference} />
            </SectionCard>

            {actionNote ? <Note tone="success">{actionNote}</Note> : null}
            {actionError ? <Note tone="error">{actionError}</Note> : null}

            {record.status === 'confirmed' ? (
              <Card style={styles.actions}>
                <Text style={styles.actionTitle}>Close out this booking</Text>
                <Text style={styles.actionBody}>
                  Only confirmed bookings can change status. All actions are audited by the server.
                </Text>
                <Button
                  label="Mark completed"
                  icon="checkmark-done-outline"
                  onPress={() => confirmAction('complete')}
                  loading={busyAction === 'complete'}
                  disabled={busyAction !== null}
                />
                <Button
                  label="Mark no-show"
                  variant="secondary"
                  icon="person-remove-outline"
                  onPress={() => confirmAction('no_show')}
                  loading={busyAction === 'no_show'}
                  disabled={busyAction !== null}
                />
                <Button
                  label="Cancel booking"
                  variant="danger"
                  icon="close-circle-outline"
                  onPress={() => confirmAction('cancel')}
                  loading={busyAction === 'cancel'}
                  disabled={busyAction !== null}
                />
              </Card>
            ) : (
              <Note tone="neutral">
                This booking is {titleCase(record.status).toLowerCase()}. Its status is final.
              </Note>
            )}
          </>
        ) : null}
      </ScreenScroll>
    </Screen>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={17} color={colors.muted} />
      <View style={styles.flex}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue} selectable>
          {value ?? 'Not provided'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl },
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
  detailRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', paddingVertical: 6 },
  detailLabel: { ...typography.small, color: colors.muted, fontSize: 12 },
  detailValue: { ...typography.body, color: colors.ink },
  actions: { gap: spacing.sm },
  actionTitle: { ...typography.subtitle, color: colors.ink },
  actionBody: { ...typography.small, color: colors.muted, marginBottom: spacing.sm },
});
