import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { getCategories } from '@/api/public';
import {
  completeOnboarding,
  createAvailabilityRule,
  createExpert,
  createService,
  geocodeAddress,
  getOnboarding,
  listAvailabilityRules,
  listExperts,
  listLocations,
  listServices,
  setExpertServices,
  updateProfile,
  upsertPrimaryLocation,
} from '@/api/tenant';
import { useAuth } from '@/auth/AuthProvider';
import { Button, Chip, HorizontalChips, TextField } from '@/components/controls';
import { Badge, Note } from '@/components/display';
import {
  Card,
  ErrorBlock,
  LoadingBlock,
  Screen,
  ScreenHeader,
  ScreenScroll,
  SectionCard,
} from '@/components/layout';
import { DEFAULT_TIMEZONE, TIMEZONES, WEEKDAYS, uniqueSlug, weekdayLabel } from '@/lib/constants';
import { messageFor } from '@/lib/errors';
import { useAsync } from '@/lib/useAsync';
import { colors, radius, spacing, typography } from '@/theme';
import type { Category } from '@/types';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const STEP_LABELS: Record<string, string> = {
  profile: 'Business profile',
  location: 'Location and address',
  services: 'At least one service',
  team: 'Expert assigned to a service',
  availability: 'Weekly availability',
};

type ProfileForm = {
  name: string;
  primaryCategoryId: string;
  timezone: string;
  description: string;
  publicEmail: string;
  publicPhone: string;
};

type LocationForm = {
  name: string;
  addressLine: string;
  locality: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: string;
  longitude: string;
};

export default function TenantSetupScreen() {
  const auth = useAuth();
  const router = useRouter();
  const tenant = auth.activeTenant;

  const [profileForm, setProfileForm] = useState<ProfileForm | null>(null);
  const [locationForm, setLocationForm] = useState<LocationForm | null>(null);
  const [availabilityExpertId, setAvailabilityExpertId] = useState('');
  const [availabilityDays, setAvailabilityDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startLocalTime, setStartLocalTime] = useState('10:00');
  const [endLocalTime, setEndLocalTime] = useState('18:00');

  const [serviceName, setServiceName] = useState('');
  const [serviceDuration, setServiceDuration] = useState('45');
  const [servicePrice, setServicePrice] = useState('');

  const [expertName, setExpertName] = useState('');
  const [expertBio, setExpertBio] = useState('');

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const initialized = useRef(false);

  const data = useAsync(async () => {
    if (!tenant) {
      throw new Error('No studio selected');
    }
    const [onboarding, locations, services, experts, categories] = await Promise.all([
      getOnboarding(tenant.tenantId),
      listLocations(tenant.tenantId),
      listServices(tenant.tenantId),
      listExperts(tenant.tenantId),
      getCategories().catch(() => [] as Category[]),
    ]);
    return { onboarding, locations, services, experts, categories };
  }, [tenant?.tenantId]);

  const rules = useAsync(async () => {
    if (!tenant || !availabilityExpertId) {
      return [];
    }
    return listAvailabilityRules(tenant.tenantId, availabilityExpertId);
  }, [tenant?.tenantId, availabilityExpertId]);

  useEffect(() => {
    const loaded = data.data;
    if (!loaded || initialized.current) {
      return;
    }
    initialized.current = true;

    const profile = loaded.onboarding.tenant;
    setProfileForm({
      name: profile.name,
      primaryCategoryId: profile.primaryCategory?.id ?? '',
      timezone: profile.timezone ?? DEFAULT_TIMEZONE,
      description: profile.description ?? '',
      publicEmail: profile.publicEmail ?? '',
      publicPhone: profile.publicPhone ?? '',
    });

    const location = loaded.locations[0];
    setLocationForm({
      name: location?.name ?? 'Main studio',
      addressLine: location?.addressLine ?? '',
      locality: location?.locality ?? '',
      city: location?.city ?? '',
      state: location?.state ?? '',
      postalCode: location?.postalCode ?? '',
      latitude: location?.latitude ?? '',
      longitude: location?.longitude ?? '',
    });

    setAvailabilityExpertId(loaded.experts[0]?.id ?? '');
  }, [data.data]);

  if (!tenant) {
    return (
      <Screen>
        <View style={styles.center}>
          <ErrorBlock message="No studio membership was found for this account." onRetry={auth.refresh} />
        </View>
      </Screen>
    );
  }

  const onboarding = data.data?.onboarding;
  const services = data.data?.services ?? [];
  const experts = data.data?.experts ?? [];
  const categories = data.data?.categories ?? [];
  const activeServices = services.filter((service) => service.isActive);
  const completedSteps = onboarding ? Object.values(onboarding.steps).filter(Boolean).length : 0;
  const totalSteps = onboarding ? Object.keys(onboarding.steps).length : 5;

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await action();
      data.refresh();
    } catch (caught) {
      // Client-side validation throws plain Errors with user-facing text; API
      // errors already carry a safe message.
      setError(
        messageFor(
          caught,
          caught instanceof Error && caught.message ? caught.message : 'That change could not be saved. Try again.',
        ),
      );
    } finally {
      setBusy(null);
    }
  }

  function saveProfile() {
    if (!profileForm || !tenant) return;
    void run('profile', async () => {
      if (profileForm.name.trim().length < 2) {
        throw new Error('Enter your business name.');
      }
      if (!profileForm.primaryCategoryId) {
        throw new Error('Choose a primary category.');
      }
      await updateProfile(tenant.tenantId, {
        name: profileForm.name.trim(),
        primaryCategoryId: profileForm.primaryCategoryId,
        timezone: profileForm.timezone,
        description: profileForm.description.trim() || undefined,
        publicEmail: profileForm.publicEmail.trim() || undefined,
        publicPhone: profileForm.publicPhone.trim() || undefined,
      });
      setNotice('Business profile saved.');
    });
  }

  function findCoordinates() {
    if (!locationForm || !tenant) return;
    const address = [
      locationForm.addressLine,
      locationForm.locality,
      locationForm.city,
      locationForm.state,
      locationForm.postalCode,
    ]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(', ');

    if (!address) {
      setError('Add the street address before looking up coordinates.');
      return;
    }

    void run('geocode', async () => {
      const result = await geocodeAddress(tenant.tenantId, address);
      setLocationForm((current) =>
        current
          ? {
              ...current,
              latitude: String(result.latitude),
              longitude: String(result.longitude),
              locality: result.locality ?? current.locality,
              city: result.city ?? current.city,
              state: result.state ?? current.state,
              postalCode: result.postalCode ?? current.postalCode,
            }
          : current,
      );
      setNotice(`Coordinates found for ${result.formattedAddress}.`);
    });
  }

  function saveLocation() {
    if (!locationForm || !tenant) return;
    void run('location', async () => {
      const latitude = Number(locationForm.latitude);
      const longitude = Number(locationForm.longitude);
      if (locationForm.name.trim().length < 2) {
        throw new Error('Give this location a name.');
      }
      if (locationForm.addressLine.trim().length < 3) {
        throw new Error('Enter the street address.');
      }
      if (locationForm.locality.trim().length < 2 || locationForm.city.trim().length < 2) {
        throw new Error('Enter both the locality and the city.');
      }
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error('Add latitude and longitude, or use "Find coordinates".');
      }
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        throw new Error('Latitude must be between -90 and 90 and longitude between -180 and 180.');
      }

      await upsertPrimaryLocation(tenant.tenantId, {
        name: locationForm.name.trim(),
        addressLine: locationForm.addressLine.trim(),
        locality: locationForm.locality.trim(),
        city: locationForm.city.trim(),
        state: locationForm.state.trim() || undefined,
        postalCode: locationForm.postalCode.trim() || undefined,
        latitude,
        longitude,
      });
      setNotice('Location saved.');
    });
  }

  function addService() {
    if (!tenant) return;
    void run('service', async () => {
      const name = serviceName.trim();
      const durationMinutes = Number(serviceDuration);
      if (name.length < 2) {
        throw new Error('Enter a service name.');
      }
      if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) {
        throw new Error('Duration must be between 5 and 480 minutes.');
      }
      if (services.some((service) => service.name.toLowerCase() === name.toLowerCase())) {
        throw new Error('A service with this name already exists.');
      }
      const price = servicePrice.trim() ? Number(servicePrice) : undefined;
      if (price !== undefined && (!Number.isFinite(price) || price < 0)) {
        throw new Error('Price must be a positive number or left empty.');
      }

      await createService(tenant.tenantId, {
        name,
        slug: uniqueSlug(name, services.map((service) => service.slug), 'service'),
        durationMinutes,
        displayPriceAmount: price,
      });
      setServiceName('');
      setServicePrice('');
      setNotice(`${name} added.`);
    });
  }

  function addExpert() {
    if (!tenant) return;
    void run('expert', async () => {
      const displayName = expertName.trim();
      if (displayName.length < 2) {
        throw new Error('Enter the expert name.');
      }
      const expert = await createExpert(tenant.tenantId, {
        displayName,
        slug: uniqueSlug(displayName, experts.map((row) => row.slug), 'expert'),
        shortBio: expertBio.trim() || undefined,
      });
      const serviceIds = activeServices.map((service) => service.id);
      if (serviceIds.length > 0) {
        await setExpertServices(tenant.tenantId, expert.id, serviceIds);
      }
      setExpertName('');
      setExpertBio('');
      setAvailabilityExpertId(expert.id);
      setNotice(`${displayName} added${serviceIds.length > 0 ? ' and assigned to your services' : ''}.`);
    });
  }

  function toggleDay(day: number) {
    setAvailabilityDays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day],
    );
  }

  function saveAvailability() {
    if (!tenant) return;
    void run('availability', async () => {
      if (!availabilityExpertId) {
        throw new Error('Add an expert before setting availability.');
      }
      if (availabilityDays.length === 0) {
        throw new Error('Choose at least one working day.');
      }
      if (!TIME_PATTERN.test(startLocalTime) || !TIME_PATTERN.test(endLocalTime)) {
        throw new Error('Use 24-hour times such as 10:00 and 18:00.');
      }
      if (startLocalTime >= endLocalTime) {
        throw new Error('Closing time must be after opening time.');
      }

      for (const dayOfWeek of availabilityDays) {
        await createAvailabilityRule(tenant.tenantId, availabilityExpertId, {
          dayOfWeek,
          startLocalTime,
          endLocalTime,
        });
      }
      rules.refresh();
      setNotice('Weekly availability saved.');
    });
  }

  function goLive() {
    if (!tenant) return;
    void run('live', async () => {
      await completeOnboarding(tenant.tenantId);
      await auth.refresh();
      router.replace('/(tenant)');
    });
  }

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
          eyebrow="Business setup"
          title={onboarding?.isActive ? 'Your studio is live' : 'Finish your studio setup'}
          subtitle="Complete every step below, then publish so customers can book you."
        />

        {data.loading && !data.data ? <LoadingBlock label="Loading your setup…" /> : null}
        {data.error ? <ErrorBlock message={data.error} onRetry={data.refresh} /> : null}
        {error ? <Note tone="error">{error}</Note> : null}
        {notice ? <Note tone="success">{notice}</Note> : null}

        {onboarding ? (
          <View style={styles.progressRow}>
            <View style={styles.flex}>
              <Text style={styles.progressLabel}>
                {completedSteps} of {totalSteps} steps complete
              </Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.round((completedSteps / Math.max(totalSteps, 1)) * 100)}%` },
                  ]}
                />
              </View>
            </View>
            <Badge
              label={onboarding.isActive ? 'Live' : onboarding.ready ? 'Ready' : 'Draft'}
              tone={onboarding.isActive ? 'success' : onboarding.ready ? 'teal' : 'warning'}
              dot
            />
          </View>
        ) : null}

        {onboarding ? (
          <Card style={styles.checklist}>
            {Object.entries(onboarding.steps).map(([key, done]) => (
              <View key={key} style={styles.checkRow}>
                <Ionicons
                  name={done ? 'checkmark-circle' : 'ellipse-outline'}
                  size={18}
                  color={done ? colors.success : colors.muted}
                />
                <Text style={[styles.checkLabel, done ? styles.checkLabelDone : null]}>
                  {STEP_LABELS[key] ?? key}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}

        {!onboarding?.isActive ? (
          <SectionCard
            title="Go live"
            subtitle={
              onboarding?.ready
                ? 'Everything required is in place.'
                : 'The remaining items must be complete before publishing.'
            }
            action={
              <Badge
                label={onboarding?.ready ? 'Ready' : 'Blocked'}
                tone={onboarding?.ready ? 'teal' : 'warning'}
              />
            }
          >
            {onboarding && onboarding.missing.length > 0 ? (
              <Note tone="warning">Still missing: {onboarding.missing.join('; ')}.</Note>
            ) : null}
            <Button
              label={busy === 'live' ? 'Publishing…' : 'Publish my studio'}
              icon="rocket-outline"
              loading={busy === 'live'}
              disabled={busy !== null || !onboarding?.ready}
              onPress={goLive}
            />
          </SectionCard>
        ) : (
          <Button
            label="Back to my studio"
            icon="storefront-outline"
            onPress={() => router.replace('/(tenant)')}
          />
        )}

        {profileForm ? (
          <SectionCard
            title="Business profile"
            subtitle="What customers see on your Neara page."
            action={<StepBadge done={Boolean(onboarding?.steps.profile)} />}
          >
            <TextField
              label="Business name"
              value={profileForm.name}
              onChangeText={(value) => setProfileForm({ ...profileForm, name: value })}
              autoCapitalize="words"
              maxLength={120}
            />

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Primary category</Text>
              {categories.length === 0 ? (
                <Text style={styles.fieldHint}>Categories could not be loaded. Pull to refresh.</Text>
              ) : (
                <View style={styles.chipWrap}>
                  {categories.map((category) => (
                    <Chip
                      key={category.id}
                      label={category.name}
                      selected={profileForm.primaryCategoryId === category.id}
                      onPress={() => setProfileForm({ ...profileForm, primaryCategoryId: category.id })}
                    />
                  ))}
                </View>
              )}
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Timezone</Text>
              <HorizontalChips>
                {TIMEZONES.map((zone) => (
                  <Chip
                    key={zone}
                    label={zone}
                    selected={profileForm.timezone === zone}
                    onPress={() => setProfileForm({ ...profileForm, timezone: zone })}
                  />
                ))}
              </HorizontalChips>
            </View>

            <TextField
              label="About your business"
              value={profileForm.description}
              onChangeText={(value) => setProfileForm({ ...profileForm, description: value })}
              placeholder="What you offer and what customers should know before booking."
              multiline
              maxLength={1000}
            />
            <TextField
              label="Public email"
              value={profileForm.publicEmail}
              onChangeText={(value) => setProfileForm({ ...profileForm, publicEmail: value })}
              placeholder="hello@studio.com"
              keyboardType="email-address"
            />
            <TextField
              label="Public phone"
              value={profileForm.publicPhone}
              onChangeText={(value) => setProfileForm({ ...profileForm, publicPhone: value })}
              placeholder="+919876543210"
              keyboardType="phone-pad"
              maxLength={32}
            />

            <Button
              label="Save profile"
              variant="secondary"
              loading={busy === 'profile'}
              disabled={busy !== null}
              onPress={saveProfile}
            />
          </SectionCard>
        ) : null}

        {locationForm ? (
          <SectionCard
            title="Location"
            subtitle="Where customers visit. Used for nearby discovery."
            action={<StepBadge done={Boolean(onboarding?.steps.location)} />}
          >
            <TextField
              label="Location name"
              value={locationForm.name}
              onChangeText={(value) => setLocationForm({ ...locationForm, name: value })}
              placeholder="Main studio"
              autoCapitalize="words"
              maxLength={120}
            />
            <TextField
              label="Street address"
              value={locationForm.addressLine}
              onChangeText={(value) => setLocationForm({ ...locationForm, addressLine: value })}
              placeholder="12 MG Road"
              maxLength={240}
            />
            <TextField
              label="Locality"
              value={locationForm.locality}
              onChangeText={(value) => setLocationForm({ ...locationForm, locality: value })}
              placeholder="Koregaon Park"
              autoCapitalize="words"
            />
            <TextField
              label="City"
              value={locationForm.city}
              onChangeText={(value) => setLocationForm({ ...locationForm, city: value })}
              placeholder="Pune"
              autoCapitalize="words"
            />
            <TextField
              label="State"
              value={locationForm.state}
              onChangeText={(value) => setLocationForm({ ...locationForm, state: value })}
              placeholder="Maharashtra"
              autoCapitalize="words"
            />
            <TextField
              label="Postal code"
              value={locationForm.postalCode}
              onChangeText={(value) => setLocationForm({ ...locationForm, postalCode: value })}
              placeholder="411001"
              keyboardType="number-pad"
            />
            <TextField
              label="Latitude"
              value={locationForm.latitude}
              onChangeText={(value) => setLocationForm({ ...locationForm, latitude: value })}
              placeholder="18.5362"
              keyboardType="numbers-and-punctuation"
            />
            <TextField
              label="Longitude"
              value={locationForm.longitude}
              onChangeText={(value) => setLocationForm({ ...locationForm, longitude: value })}
              placeholder="73.8940"
              keyboardType="numbers-and-punctuation"
            />

            <View style={styles.actions}>
              <Button
                label="Find coordinates"
                variant="secondary"
                icon="map-outline"
                loading={busy === 'geocode'}
                disabled={busy !== null}
                onPress={findCoordinates}
              />
              <Button
                label="Save location"
                loading={busy === 'location'}
                disabled={busy !== null}
                onPress={saveLocation}
              />
            </View>
          </SectionCard>
        ) : null}

        <SectionCard
          title="Services"
          subtitle="At least one active service is required."
          action={<StepBadge done={Boolean(onboarding?.steps.services)} />}
        >
          {services.length === 0 ? (
            <Text style={styles.fieldHint}>No services yet. Add your first one below.</Text>
          ) : (
            <View style={styles.list}>
              {services.map((service) => (
                <View key={service.id} style={styles.listRow}>
                  <View style={styles.flex}>
                    <Text style={styles.listTitle}>{service.name}</Text>
                    <Text style={styles.listMeta}>
                      {service.durationMinutes} min
                      {service.displayPriceAmount ? ` · ₹${service.displayPriceAmount}` : ''}
                    </Text>
                  </View>
                  <Badge
                    label={service.isActive ? 'Active' : 'Inactive'}
                    tone={service.isActive ? 'success' : 'neutral'}
                  />
                </View>
              ))}
            </View>
          )}

          <TextField
            label="Service name"
            value={serviceName}
            onChangeText={setServiceName}
            placeholder="Signature haircut"
            autoCapitalize="sentences"
            maxLength={120}
          />
          <TextField
            label="Duration (minutes)"
            value={serviceDuration}
            onChangeText={setServiceDuration}
            placeholder="45"
            keyboardType="number-pad"
          />
          <TextField
            label="Price in INR (optional)"
            value={servicePrice}
            onChangeText={setServicePrice}
            placeholder="1200"
            keyboardType="decimal-pad"
          />
          <Button
            label="Add service"
            variant="secondary"
            loading={busy === 'service'}
            disabled={busy !== null}
            onPress={addService}
          />
        </SectionCard>

        <SectionCard
          title="Team"
          subtitle="Experts are profiles customers book; they do not sign in."
          action={<StepBadge done={Boolean(onboarding?.steps.team)} />}
        >
          {experts.length === 0 ? (
            <Text style={styles.fieldHint}>No experts yet. Add the first one below.</Text>
          ) : (
            <View style={styles.list}>
              {experts.map((expert) => (
                <View key={expert.id} style={styles.listRow}>
                  <View style={styles.flex}>
                    <Text style={styles.listTitle}>{expert.displayName}</Text>
                    <Text style={styles.listMeta}>
                      {expert.expertServices.length > 0
                        ? expert.expertServices.map((assignment) => assignment.service.name).join(', ')
                        : 'No services assigned'}
                    </Text>
                  </View>
                  <Badge
                    label={expert.isActive ? 'Active' : 'Inactive'}
                    tone={expert.isActive ? 'success' : 'neutral'}
                  />
                </View>
              ))}
            </View>
          )}

          <TextField
            label="Expert name"
            value={expertName}
            onChangeText={setExpertName}
            placeholder="Ananya Rao"
            autoCapitalize="words"
            maxLength={120}
          />
          <TextField
            label="Short bio (optional)"
            value={expertBio}
            onChangeText={setExpertBio}
            placeholder="Senior stylist, 8 years"
            maxLength={500}
          />
          {activeServices.length === 0 ? (
            <Text style={styles.fieldHint}>Add a service before adding your team.</Text>
          ) : (
            <Text style={styles.fieldHint}>
              New experts are automatically assigned to your active services.
            </Text>
          )}
          <Button
            label="Add expert"
            variant="secondary"
            loading={busy === 'expert'}
            disabled={busy !== null || activeServices.length === 0}
            onPress={addExpert}
          />
        </SectionCard>

        <SectionCard
          title="Weekly availability"
          subtitle="Customers can only book inside these windows."
          action={<StepBadge done={Boolean(onboarding?.steps.availability)} />}
        >
          {experts.length === 0 ? (
            <Text style={styles.fieldHint}>Add an expert before setting availability.</Text>
          ) : (
            <>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Expert</Text>
                <View style={styles.chipWrap}>
                  {experts.map((expert) => (
                    <Chip
                      key={expert.id}
                      label={expert.displayName}
                      selected={availabilityExpertId === expert.id}
                      onPress={() => setAvailabilityExpertId(expert.id)}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Working days</Text>
                <View style={styles.chipWrap}>
                  {WEEKDAYS.map((day) => (
                    <Chip
                      key={day.value}
                      label={day.label}
                      selected={availabilityDays.includes(day.value)}
                      onPress={() => toggleDay(day.value)}
                    />
                  ))}
                </View>
              </View>

              <TextField
                label="Opens (24-hour)"
                value={startLocalTime}
                onChangeText={setStartLocalTime}
                placeholder="10:00"
                keyboardType="numbers-and-punctuation"
              />
              <TextField
                label="Closes (24-hour)"
                value={endLocalTime}
                onChangeText={setEndLocalTime}
                placeholder="18:00"
                keyboardType="numbers-and-punctuation"
              />

              <Button
                label="Save hours"
                variant="secondary"
                loading={busy === 'availability'}
                disabled={busy !== null || !availabilityExpertId}
                onPress={saveAvailability}
              />

              <View style={styles.list}>
                {rules.data?.length ? (
                  rules.data.map((rule) => (
                    <View key={rule.id} style={styles.listRow}>
                      <Text style={styles.listTitle}>{weekdayLabel(rule.dayOfWeek)}</Text>
                      <Text style={styles.listMeta}>
                        {rule.startLocalTime} – {rule.endLocalTime}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.fieldHint}>No weekly hours saved for this expert yet.</Text>
                )}
              </View>
            </>
          )}
        </SectionCard>

        <Text style={styles.footnote}>
          Everything here goes through the same server permissions as the Neara web console, and each
          change is written to your studio audit log.
        </Text>
      </ScreenScroll>
    </Screen>
  );
}

function StepBadge({ done }: { done: boolean }) {
  return <Badge label={done ? 'Done' : 'To do'} tone={done ? 'success' : 'neutral'} dot />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  progressLabel: { ...typography.smallStrong, color: colors.ink },
  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.soft,
    overflow: 'hidden',
    marginTop: 6,
  },
  progressFill: { height: 6, borderRadius: radius.pill, backgroundColor: colors.accent },
  checklist: { gap: spacing.sm },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkLabel: { ...typography.small, color: colors.muted },
  checkLabelDone: { color: colors.ink, fontWeight: '600' },
  fieldBlock: { gap: spacing.sm },
  fieldLabel: { ...typography.smallStrong, color: colors.ink },
  fieldHint: { ...typography.small, color: colors.muted },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { gap: spacing.sm },
  list: { gap: spacing.sm, marginBottom: spacing.sm },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  listTitle: { ...typography.bodyStrong, color: colors.ink },
  listMeta: { ...typography.small, color: colors.muted },
  footnote: { ...typography.small, color: colors.muted, fontSize: 12, textAlign: 'center' },
});
