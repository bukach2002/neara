import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { lookupBooking } from '@/api/bookings';
import { useAuth } from '@/auth/AuthProvider';
import { Button, TextField } from '@/components/controls';
import { BookingReceipt, Note } from '@/components/display';
import {
  Card,
  Screen,
  ScreenHeader,
  ScreenScroll,
  SectionTitle,
} from '@/components/layout';
import { messageFor } from '@/lib/errors';
import { colors, radius, spacing, typography } from '@/theme';
import type { BookingRecord } from '@/types';

export default function AppointmentsScreen() {
  const auth = useAuth();
  const [reference, setReference] = useState('');
  const [phone, setPhone] = useState(auth.user?.mobileNumber ?? '');
  const [booking, setBooking] = useState<BookingRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function search() {
    setError(null);
    setBooking(null);

    if (reference.trim().length < 3) {
      setError('Enter the booking reference from your confirmation, for example NEAR-7A2K.');
      return;
    }
    if (!/^\+[1-9]\d{7,14}$/.test(phone.trim())) {
      setError('Enter the phone number used for the booking, including country code.');
      return;
    }

    setBusy(true);
    try {
      const result = await lookupBooking({ reference, phone });
      setBooking(result);
    } catch (caught) {
      const message = messageFor(caught, 'We could not find that booking.');
      setError(
        message.toLowerCase().includes('not found')
          ? 'No booking matches that reference and phone number.'
          : message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScreenScroll>
          <ScreenHeader
            eyebrow="Appointments"
            title="Find a booking"
            subtitle="Your reference plus the phone number on the booking is all we need."
          />

          <Card style={styles.form}>
            <TextField
              label="Booking reference"
              value={reference}
              onChangeText={(value) => setReference(value.toUpperCase())}
              placeholder="NEAR-7A2K"
              autoCapitalize="characters"
              autoComplete="off"
              maxLength={32}
              returnKeyType="next"
            />
            <TextField
              label="Mobile number"
              value={phone}
              onChangeText={setPhone}
              placeholder="+919876543210"
              keyboardType="phone-pad"
              autoComplete="tel"
              returnKeyType="search"
              onSubmitEditing={() => void search()}
            />
            <Button label="Find appointment" onPress={search} loading={busy} icon="search-outline" />
            {error ? <Note tone="error">{error}</Note> : null}
          </Card>

          {booking ? (
            <View style={styles.result}>
              <SectionTitle>Your appointment</SectionTitle>
              <Card style={styles.receiptCard}>
                <View style={styles.resultHead}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.teal} />
                  <Text style={styles.resultTitle}>We found it</Text>
                </View>
                <BookingReceipt booking={booking} />
                <Text style={styles.hint}>
                  Need to change or cancel? Contact the studio directly. Customer self-cancellation is
                  not enabled yet.
                </Text>
              </Card>
            </View>
          ) : null}

          {!booking ? (
            <View style={styles.tips}>
              <Tip icon="mail-outline" title="Check your confirmation" body="The reference is in the confirmation email and on the booking receipt in this app." />
              <Tip icon="call-outline" title="Use the same number" body="Lookup only works with the phone number the booking was made under." />
              <Tip icon="shield-checkmark-outline" title="Private by default" body="Lookup responses are rate-limited. Do not share your reference publicly." />
            </View>
          ) : null}
        </ScreenScroll>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Tip({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.tip}>
      <View style={styles.tipIcon}>
        <Ionicons name={icon} size={17} color={colors.accent} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.tipTitle}>{title}</Text>
        <Text style={styles.tipBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  form: { gap: spacing.md },
  result: { gap: spacing.md },
  receiptCard: { gap: spacing.md, borderColor: '#c7e8dd' },
  resultHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  resultTitle: { ...typography.bodyStrong, color: colors.ink },
  hint: { ...typography.small, color: colors.muted, fontSize: 12 },
  tips: { gap: spacing.md, marginTop: spacing.sm },
  tip: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  tipIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipTitle: { ...typography.bodyStrong, color: colors.ink },
  tipBody: { ...typography.small, color: colors.muted },
});
