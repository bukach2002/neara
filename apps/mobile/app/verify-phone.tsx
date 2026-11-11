import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { confirmPhoneCode, requestPhoneCode, type VerificationChannel } from '@/api/auth';
import { useAuth } from '@/auth/AuthProvider';
import { Button, IconButton, SegmentedControl, TextField } from '@/components/controls';
import { Badge, Note } from '@/components/display';
import { SectionCard, Screen, ScreenScroll } from '@/components/layout';
import { messageFor } from '@/lib/errors';
import { colors, spacing, typography } from '@/theme';

const RESEND_SECONDS = 30;

export default function VerifyPhoneScreen() {
  const auth = useAuth();
  const router = useRouter();
  const number = auth.user?.mobileNumber ?? null;
  const [channel, setChannel] = useState<VerificationChannel>('sms');
  const [step, setStep] = useState<'idle' | 'sent'>('idle');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'send' | 'confirm' | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [verified, setVerified] = useState(Boolean(auth.user?.mobileVerified));

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const handle = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(handle);
  }, [cooldown]);

  async function send() {
    if (!number) {
      return;
    }
    setBusy('send');
    setError(null);
    setNote(null);
    try {
      await requestPhoneCode(number, channel);
      setStep('sent');
      setCooldown(RESEND_SECONDS);
      setNote(
        `We sent a 6-digit code to ${number} ${channel === 'whatsapp' ? 'on WhatsApp' : 'by SMS'}. It expires in 10 minutes.`,
      );
    } catch (caught) {
      setError(messageFor(caught, 'We could not send the code. Try again in a moment.'));
    } finally {
      setBusy(null);
    }
  }

  async function confirm() {
    if (!number) {
      return;
    }
    const otp = code.trim();
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code from the message.');
      return;
    }

    setBusy('confirm');
    setError(null);
    try {
      await confirmPhoneCode({ identifier: number, otp, channel });
      await auth.refresh().catch(() => undefined);
      setVerified(true);
      setStep('idle');
      setCode('');
      setNote(null);
    } catch (caught) {
      setError(messageFor(caught, 'That code is wrong or has expired. Request a new one.'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <View style={styles.topBar}>
        <IconButton icon="arrow-back" label="Back to account" onPress={() => router.back()} />
        <Text style={styles.topBarTitle}>Mobile number</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScreenScroll contentStyle={styles.content}>
        {!number ? (
          <SectionCard title="No mobile number on file">
            <Text style={styles.body}>
              Add a mobile number from the studio or contact support, then return here to confirm it. Booking
              details are matched to this account by the number on the appointment.
            </Text>
          </SectionCard>
        ) : (
          <SectionCard title="Mobile verification">
            <View style={styles.numberRow}>
              <Ionicons name="call-outline" size={18} color={colors.teal} />
              <Text style={styles.number} selectable>
                {number}
              </Text>
              {verified ? <Badge label="Verified" tone="success" dot /> : <Badge label="Not verified" tone="warning" />}
            </View>

            {verified ? (
              <>
                <Text style={styles.body}>
                  This number is confirmed. It is used only to match your bookings and to reach you about
                  appointments.
                </Text>
                <Button label="Done" variant="secondary" icon="checkmark-outline" onPress={() => router.back()} />
              </>
            ) : (
              <>
                <Text style={styles.body}>
                  We will send you a 6-digit code. Enter it below to prove this number belongs to you.
                </Text>

                {step === 'idle' ? (
                  <SegmentedControl
                    options={[
                      { label: 'SMS', value: 'sms' },
                      { label: 'WhatsApp', value: 'whatsapp' },
                    ]}
                    value={channel}
                    onChange={setChannel}
                  />
                ) : null}

                {step === 'sent' ? (
                  <TextField
                    label="6-digit code"
                    value={code}
                    onChangeText={setCode}
                    placeholder="123456"
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    maxLength={6}
                    hint="Sent to the number above. Codes expire after 10 minutes."
                  />
                ) : null}

                {step === 'idle' ? (
                  <Button
                    label={busy === 'send' ? 'Sending…' : 'Send code'}
                    icon="paper-plane-outline"
                    loading={busy === 'send'}
                    disabled={busy !== null}
                    onPress={() => void send()}
                  />
                ) : (
                  <>
                    <Button
                      label="Confirm number"
                      icon="shield-checkmark-outline"
                      loading={busy === 'confirm'}
                      disabled={busy !== null || code.trim().length !== 6}
                      onPress={() => void confirm()}
                    />
                    <Button
                      label={cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                      variant="secondary"
                      icon="refresh-outline"
                      loading={busy === 'send'}
                      disabled={busy !== null || cooldown > 0}
                      onPress={() => void send()}
                    />
                  </>
                )}

                {note ? <Note tone="neutral">{note}</Note> : null}
              </>
            )}

            {error ? <Note tone="error">{error}</Note> : null}
          </SectionCard>
        )}

        <SectionCard title="Why we ask">
          <Text style={styles.body}>
            A confirmed number lets the studio reach the right person about an appointment and makes it harder
            for someone else to claim your booking. Neara never shows this number publicly.
          </Text>
        </SectionCard>

        <Text style={styles.footnote}>
          The phone verification flag is enforced server-side once Neara enables it for customer accounts.
        </Text>
      </ScreenScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  topBarTitle: { ...typography.subtitle, color: colors.ink, flex: 1, textAlign: 'center' },
  topBarSpacer: { width: 36 },
  numberRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  number: { ...typography.bodyStrong, color: colors.ink, flexGrow: 1 },
  body: { ...typography.body, color: colors.muted },
  footnote: { ...typography.small, color: colors.muted, paddingHorizontal: spacing.xs },
});
