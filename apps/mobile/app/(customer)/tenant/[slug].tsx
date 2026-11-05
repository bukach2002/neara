import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { createBooking } from '@/api/bookings';
import { getAvailableSlots, getTenant } from '@/api/public';
import { useAuth } from '@/auth/AuthProvider';
import { Button, Chip, IconButton, SwitchRow, TextField } from '@/components/controls';
import { Avatar, Badge, BookingReceipt, KeyValue, Note } from '@/components/display';
import {
  Card,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  Screen,
  SectionTitle,
} from '@/components/layout';
import {
  addDaysToDateKey,
  dateKeyParts,
  deviceDateKey,
  formatMoney,
  formatTime,
  slotTimeRange,
  todayKeyInTimezone,
} from '@/lib/format';
import { messageFor } from '@/lib/errors';
import { useAsync } from '@/lib/useAsync';
import { colors, radius, spacing, typography } from '@/theme';
import type { AvailableSlot, BookingRecord } from '@/types';

const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

export default function TenantBookingScreen() {
  const params = useLocalSearchParams<{ slug?: string | string[] }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const router = useRouter();
  const auth = useAuth();

  const detail = useAsync(() => (slug ? getTenant(slug) : Promise.reject(new Error('missing slug'))), [slug]);

  const [serviceId, setServiceId] = useState<string | null>(null);
  const [expertId, setExpertId] = useState<string | null>(null);
  const [dateKey, setDateKey] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);

  const [customerName, setCustomerName] = useState(auth.user?.name ?? '');
  const [customerPhone, setCustomerPhone] = useState(auth.user?.mobileNumber ?? '');
  const [customerEmail, setCustomerEmail] = useState(auth.user?.email ?? '');
  const [customerNote, setCustomerNote] = useState('');
  const [consent, setConsent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState<BookingRecord | null>(null);

  const tenant = detail.data;
  const timezone = tenant?.timezone ?? null;

  useEffect(() => {
    if (!serviceId && tenant?.services[0]) {
      setServiceId(tenant.services[0].id);
    }
  }, [tenant, serviceId]);

  useEffect(() => {
    if (tenant?.timezone && !dateKey) {
      setDateKey(todayKeyInTimezone(tenant.timezone));
    }
  }, [tenant?.timezone, dateKey]);

  useEffect(() => {
    setExpertId(null);
    setSelectedSlot(null);
    setBooking(null);
  }, [serviceId]);

  useEffect(() => {
    setSelectedSlot(null);
  }, [dateKey, expertId]);

  const selectedService = useMemo(
    () => tenant?.services.find((service) => service.id === serviceId) ?? null,
    [tenant, serviceId],
  );

  const eligibleExperts = useMemo(
    () => selectedService?.expertServices.map((assignment) => assignment.expert) ?? [],
    [selectedService],
  );

  const days = useMemo(() => {
    const anchor = timezone ? todayKeyInTimezone(timezone) : deviceDateKey(0);
    return Array.from({ length: 14 }, (_, index) => addDaysToDateKey(anchor, index));
  }, [timezone]);

  const slots = useAsync(async () => {
    if (!slug || !serviceId || !dateKey) {
      return { items: [] as AvailableSlot[] };
    }
    return getAvailableSlots({ slug, serviceId, date: dateKey, expertId: expertId ?? undefined });
  }, [slug, serviceId, dateKey, expertId, tenant?.id]);

  const uniqueSlots = useMemo(() => {
    const byStart = new Map<string, AvailableSlot>();
    for (const slot of slots.data?.items ?? []) {
      if (!byStart.has(slot.startsAt)) {
        byStart.set(slot.startsAt, slot);
      }
    }
    return [...byStart.values()];
  }, [slots.data]);

  if (!slug) {
    return (
      <Screen>
        <ErrorBlock message="That studio link is incomplete." onRetry={() => router.replace('/(customer)/discover')} />
      </Screen>
    );
  }

  function resetForAnotherBooking() {
    setBooking(null);
    setSelectedSlot(null);
    setConsent(false);
    setCustomerNote('');
    slots.refresh();
  }

  async function submitBooking() {
    setFormError(null);
    if (!slug) {
      setFormError('That studio link is incomplete.');
      return;
    }
    if (!selectedService || !selectedSlot) {
      setFormError('Choose a service, date, and time first.');
      return;
    }
    if (customerName.trim().length < 2) {
      setFormError('Enter the name the studio should expect.');
      return;
    }
    if (!PHONE_PATTERN.test(customerPhone.trim())) {
      setFormError('Enter your mobile number with country code, for example +919876543210.');
      return;
    }
    if (customerEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
      setFormError('That email address does not look right.');
      return;
    }
    if (!consent) {
      setFormError('Consent is required so the studio can confirm and contact you about this booking.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createBooking(slug, {
        serviceId: selectedService.id,
        ...(expertId ? { expertId } : {}),
        startsAt: selectedSlot.startsAt,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        ...(customerEmail.trim() ? { customerEmail: customerEmail.trim().toLowerCase() } : {}),
        ...(customerNote.trim() ? { customerNote: customerNote.trim() } : {}),
        consentAccepted: true,
      });
      setBooking(created);
      slots.refresh();
    } catch (error) {
      setFormError(messageFor(error, 'We could not complete the booking. Try again.'));
      slots.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const phoneLocked = Boolean(auth.user?.mobileNumber);
  const emailLocked = Boolean(auth.user?.email);

  return (
    <Screen>
      <View style={styles.topBar}>
        <IconButton icon="arrow-back" label="Back to discover" onPress={() => router.back()} />
        <Text style={styles.topBarTitle}>Studio</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={detail.loading && Boolean(tenant)}
            onRefresh={() => {
              detail.refresh();
              slots.refresh();
            }}
            tintColor={colors.accent}
          />
        }
      >
        {detail.loading && !tenant ? <LoadingBlock label="Opening studio…" /> : null}
        {detail.error && !tenant ? <ErrorBlock message={detail.error} onRetry={detail.refresh} /> : null}

        {tenant ? (
          <>
            <Card style={styles.hero}>
              <View style={styles.heroHead}>
                {tenant.logoUrl ? (
                  <Image source={{ uri: tenant.logoUrl }} style={styles.logo} accessibilityLabel={`${tenant.name} logo`} />
                ) : (
                  <Avatar name={tenant.name} size={58} />
                )}
                <View style={styles.heroBody}>
                  <Text style={styles.tenantName}>{tenant.name}</Text>
                  <Text style={styles.tenantMeta}>
                    {tenant.primaryCategory?.name ?? 'Studio'}
                    {tenant.locations[0] ? ` · ${tenant.locations[0].locality}` : ''}
                  </Text>
                  <Badge label="Booking open" tone="teal" dot />
                </View>
              </View>

              {tenant.description ? <Text style={styles.description}>{tenant.description}</Text> : null}

              {tenant.locations[0] ? (
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={16} color={colors.muted} />
                  <Text style={styles.locationText}>
                    {tenant.locations[0].name} · {tenant.locations[0].addressLine}, {tenant.locations[0].locality},{' '}
                    {tenant.locations[0].city}
                  </Text>
                </View>
              ) : null}
            </Card>

            {booking ? (
              <Card style={styles.successCard}>
                <View style={styles.successHead}>
                  <View style={styles.successIcon}>
                    <Ionicons name="checkmark" size={22} color={colors.success} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.successTitle}>You&apos;re booked</Text>
                    <Text style={styles.successBody}>
                      The studio has this slot. A confirmation email goes out if you added one.
                    </Text>
                  </View>
                </View>

                <BookingReceipt booking={booking} />

                <View style={styles.successActions}>
                  <Button
                    label="View my appointments"
                    onPress={() => router.push('/(customer)/appointments')}
                  />
                  <Button label="Book another service" variant="secondary" onPress={resetForAnotherBooking} />
                </View>
              </Card>
            ) : (
              <>
                <View style={styles.section}>
                  <SectionTitle>Choose a service</SectionTitle>
                  {tenant.services.length === 0 ? (
                    <Card>
                      <EmptyState
                        icon="time-outline"
                        title="No services are open for booking"
                        body="This studio has not published a bookable service yet."
                      />
                    </Card>
                  ) : (
                    <View style={styles.serviceList}>
                      {tenant.services.map((service) => {
                        const active = service.id === serviceId;
                        const price = formatMoney(service.displayPriceAmount, service.displayPriceCurrency);
                        return (
                          <Pressable
                            key={service.id}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: active }}
                            onPress={() => setServiceId(service.id)}
                            style={[styles.serviceCard, active ? styles.serviceCardActive : null]}
                          >
                            <View style={styles.serviceBody}>
                              <Text style={styles.serviceName}>{service.name}</Text>
                              <Text style={styles.serviceMeta}>
                                {service.durationMinutes} min · {service.expertServices.length} expert
                                {service.expertServices.length === 1 ? '' : 's'}
                              </Text>
                              {service.description ? (
                                <Text style={styles.serviceDescription} numberOfLines={2}>
                                  {service.description}
                                </Text>
                              ) : null}
                            </View>
                            <View style={styles.serviceRight}>
                              {price ? <Text style={styles.servicePrice}>{price}</Text> : null}
                              <View style={[styles.radio, active ? styles.radioActive : null]}>
                                {active ? <View style={styles.radioDot} /> : null}
                              </View>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>

                {selectedService ? (
                  <View style={styles.section}>
                    <SectionTitle>Expert</SectionTitle>
                    {eligibleExperts.length === 0 ? (
                      <Note tone="warning">
                        No active expert is assigned to this service yet. Pick another service or check
                        back soon.
                      </Note>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                        <Chip
                          label="Any available expert"
                          selected={expertId === null}
                          onPress={() => setExpertId(null)}
                        />
                        {eligibleExperts.map((expert) => (
                          <Chip
                            key={expert.id}
                            label={expert.displayName}
                            selected={expertId === expert.id}
                            onPress={() => setExpertId(expert.id)}
                          />
                        ))}
                      </ScrollView>
                    )}
                  </View>
                ) : null}

                {selectedService && eligibleExperts.length > 0 ? (
                  <>
                    <View style={styles.section}>
                      <SectionTitle>Date</SectionTitle>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
                        {days.map((day) => {
                          const parts = dateKeyParts(day);
                          const active = day === dateKey;
                          return (
                            <Pressable
                              key={day}
                              accessibilityRole="radio"
                              accessibilityState={{ selected: active }}
                              onPress={() => setDateKey(day)}
                              style={[styles.dateCell, active ? styles.dateCellActive : null]}
                            >
                              <Text style={[styles.dateWeekday, active ? styles.dateTextActive : null]}>
                                {parts.weekday}
                              </Text>
                              <Text style={[styles.dateDay, active ? styles.dateTextActive : null]}>
                                {parts.day}
                              </Text>
                              <Text style={[styles.dateMonth, active ? styles.dateTextActive : null]}>
                                {parts.month}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>

                    <View style={styles.section}>
                      <SectionTitle>Available times</SectionTitle>
                      {slots.loading ? <LoadingBlock label="Checking live availability…" /> : null}
                      {slots.error ? <ErrorBlock message={slots.error} onRetry={slots.refresh} /> : null}
                      {!slots.loading && !slots.error && uniqueSlots.length === 0 ? (
                        <Card>
                          <EmptyState
                            icon="calendar-outline"
                            title="No slots left on this day"
                            body="Availability is live and changes quickly. Try the next date."
                          />
                        </Card>
                      ) : null}
                      {uniqueSlots.length > 0 ? (
                        <View style={styles.slotGrid}>
                          {uniqueSlots.map((slot) => {
                            const active = selectedSlot?.startsAt === slot.startsAt;
                            return (
                              <Pressable
                                key={slot.startsAt}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: active }}
                                accessibilityLabel={slotTimeRange(slot, timezone)}
                                onPress={() => setSelectedSlot(slot)}
                                style={[styles.slot, active ? styles.slotActive : null]}
                              >
                                <Text style={[styles.slotTime, active ? styles.slotTextActive : null]}>
                                  {formatTime(slot.startsAt, timezone)}
                                </Text>
                                <Text style={[styles.slotMeta, active ? styles.slotMetaActive : null]} numberOfLines={1}>
                                  {expertId ? 'with your expert' : slot.expert.displayName}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      ) : null}
                      <Text style={styles.slotHint}>
                        Slots respect the studio&apos;s timezone ({timezone ?? 'local time'}), a 2-hour
                        minimum notice, and a 30-day booking window.
                      </Text>
                    </View>

                    {selectedSlot ? (
                      <Card style={styles.form}>
                        <View style={styles.formHead}>
                          <View style={styles.flex}>
                            <Text style={styles.formTitle}>Confirm your details</Text>
                            <Text style={styles.formSubtitle}>
                              {selectedService.name} · {formatTime(selectedSlot.startsAt, timezone)} ·{' '}
                              {selectedSlot.expert.displayName}
                            </Text>
                          </View>
                          <IconButton
                            icon="close"
                            label="Clear selected time"
                            onPress={() => setSelectedSlot(null)}
                          />
                        </View>

                        <TextField
                          label="Full name"
                          value={customerName}
                          onChangeText={setCustomerName}
                          placeholder="Asha Menon"
                          autoCapitalize="words"
                          autoComplete="name"
                        />
                        <TextField
                          label="Mobile number"
                          value={customerPhone}
                          onChangeText={setCustomerPhone}
                          placeholder="+919876543210"
                          keyboardType="phone-pad"
                          autoComplete="tel"
                          editable={!phoneLocked}
                          hint={phoneLocked ? 'Locked to the mobile number on your Neara account.' : 'Include the country code.'}
                        />
                        <TextField
                          label="Email (optional)"
                          value={customerEmail}
                          onChangeText={setCustomerEmail}
                          placeholder="you@example.com"
                          keyboardType="email-address"
                          autoComplete="email"
                          editable={!emailLocked}
                          hint={emailLocked ? 'Locked to the email on your Neara account.' : undefined}
                        />
                        <TextField
                          label="Note for the studio (optional)"
                          value={customerNote}
                          onChangeText={setCustomerNote}
                          placeholder="Anything the expert should know?"
                          multiline
                          maxLength={500}
                        />

                        <SwitchRow
                          title="I agree to booking contact"
                          subtitle="The studio may contact me about this appointment. I have read the privacy terms."
                          value={consent}
                          onValueChange={setConsent}
                        />

                        {formError ? <Note tone="error">{formError}</Note> : null}

                        <Button
                          label={`Confirm · ${formatTime(selectedSlot.startsAt, timezone)}`}
                          onPress={submitBooking}
                          loading={submitting}
                          icon="calendar-outline"
                        />
                        <Text style={styles.formFootnote}>
                          No payment is taken. Double booking is blocked by the server, so if another
                          customer takes this slot you will be asked to choose again.
                        </Text>
                      </Card>
                    ) : null}
                  </>
                ) : null}

                <Card style={styles.policy}>
                  <KeyValue label="Timezone" value={timezone} />
                  <Text style={styles.policyText}>
                    Need to change or cancel? Contact the studio directly; customer self-cancellation
                    is not part of the current release. Your booking reference is your key at the desk.
                  </Text>
                </Card>
              </>
            )}
          </>
        ) : null}
      </ScrollView>
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
  content: { paddingHorizontal: spacing.xl, paddingBottom: 60, gap: spacing.xl },
  hero: { gap: spacing.md },
  heroHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: { width: 58, height: 58, borderRadius: radius.md, backgroundColor: colors.soft },
  heroBody: { flex: 1, gap: 4 },
  tenantName: { ...typography.title, color: colors.ink },
  tenantMeta: { ...typography.small, color: colors.muted },
  description: { ...typography.body, color: colors.ink },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  locationText: { ...typography.small, color: colors.muted, flex: 1 },
  section: { gap: spacing.md },
  serviceList: { gap: spacing.sm },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  serviceCardActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  serviceBody: { flex: 1, gap: 2 },
  serviceName: { ...typography.bodyStrong, color: colors.ink },
  serviceMeta: { ...typography.small, color: colors.muted },
  serviceDescription: { ...typography.small, color: colors.muted, fontSize: 12 },
  serviceRight: { alignItems: 'flex-end', gap: spacing.sm },
  servicePrice: { ...typography.smallStrong, color: colors.ink },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  chipRow: { gap: spacing.sm, paddingRight: spacing.lg },
  dateRow: { gap: spacing.sm, paddingRight: spacing.lg },
  dateCell: {
    width: 58,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  dateCellActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  dateWeekday: { ...typography.small, color: colors.muted, fontSize: 11 },
  dateDay: { ...typography.subtitle, color: colors.ink },
  dateMonth: { ...typography.small, color: colors.muted, fontSize: 10 },
  dateTextActive: { color: '#ffffff' },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slot: {
    flexBasis: '47%',
    flexGrow: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: 1,
  },
  slotActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  slotTime: { ...typography.bodyStrong, color: colors.ink },
  slotMeta: { ...typography.small, color: colors.muted, fontSize: 11 },
  slotTextActive: { color: '#ffffff' },
  slotMetaActive: { color: '#dbe8fb' },
  slotHint: { ...typography.small, color: colors.muted, fontSize: 12 },
  form: { gap: spacing.md },
  formHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  formTitle: { ...typography.subtitle, color: colors.ink },
  formSubtitle: { ...typography.small, color: colors.muted, marginTop: 2 },
  formFootnote: { ...typography.small, color: colors.muted, fontSize: 12 },
  successCard: { gap: spacing.lg, borderColor: '#bfe8d2', backgroundColor: '#fbfefc' },
  successHead: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  successIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { ...typography.subtitle, color: colors.ink },
  successBody: { ...typography.small, color: colors.muted, marginTop: 2 },
  successActions: { gap: spacing.sm },
  policy: { gap: spacing.sm },
  policyText: { ...typography.small, color: colors.muted },
});
