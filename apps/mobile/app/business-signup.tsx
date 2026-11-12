import { Ionicons } from '@expo/vector-icons';
import { Link, Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { checkSlugAvailability } from '@/api/onboarding';
import { useAuth } from '@/auth/AuthProvider';
import { Button, Chip, HorizontalChips, PasswordField, TextField } from '@/components/controls';
import { BrandMark, Note } from '@/components/display';
import { Card, Screen, ScreenScroll } from '@/components/layout';
import { DEFAULT_TIMEZONE, TIMEZONES, slugify } from '@/lib/constants';
import { messageFor } from '@/lib/errors';
import { openExternal, PRIVACY_URL, TERMS_URL } from '@/lib/links';
import { colors, spacing, typography } from '@/theme';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type SlugState =
  | { state: 'checking' }
  | { state: 'available' }
  | { state: 'unavailable'; message: string; suggestion?: string };

export default function BusinessSignupScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [businessName, setBusinessName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugState, setSlugState] = useState<SlugState | null>(null);
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [timezone, setTimezone] = useState<string>(DEFAULT_TIMEZONE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);
  const slugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (slugTimer.current) clearTimeout(slugTimer.current);
    };
  }, []);

  // Signup itself authenticates the owner, so only bounce sessions that already
  // existed before this screen created one.
  if (!registered && auth.status === 'authenticated' && auth.role) {
    return <Redirect href={auth.goHome(auth.role)} />;
  }

  function scheduleSlugCheck(next: string) {
    if (slugTimer.current) clearTimeout(slugTimer.current);
    if (!next || !SLUG_PATTERN.test(next)) {
      setSlugState(null);
      return;
    }
    setSlugState({ state: 'checking' });
    slugTimer.current = setTimeout(() => {
      checkSlugAvailability(next)
        .then((result) => {
          if (result.available) {
            setSlugState({ state: 'available' });
            return;
          }
          setSlugState({
            state: 'unavailable',
            message: result.reason === 'reserved' ? 'Reserved by Neara' : 'Already taken',
            suggestion: result.suggestion,
          });
        })
        .catch(() => setSlugState(null));
    }, 400);
  }

  function changeBusinessName(value: string) {
    setBusinessName(value);
    if (!slugTouched) {
      const next = slugify(value);
      setSlug(next);
      scheduleSlugCheck(next);
    }
  }

  function changeSlug(value: string) {
    const next = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlugTouched(true);
    setSlug(next);
    scheduleSlugCheck(next);
  }

  async function submit() {
    setError(null);

    if (businessName.trim().length < 2) {
      setError('Enter your business name.');
      return;
    }
    if (!SLUG_PATTERN.test(slug) || slug.length < 2) {
      setError('Your page address needs lowercase letters, numbers and single hyphens.');
      return;
    }
    if (ownerName.trim().length < 2) {
      setError('Enter your own name so we know who owns the account.');
      return;
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError('Enter a working email address for your business account.');
      return;
    }
    if (password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }
    if (slugState?.state === 'unavailable') {
      setError('That page address is not available. Pick another one.');
      return;
    }

    setBusy(true);
    try {
      await auth.registerBusiness({
        businessName: businessName.trim(),
        slug,
        ownerName: ownerName.trim(),
        email: email.trim().toLowerCase(),
        password,
        timezone,
      });
      setRegistered(true);
      router.replace('/(tenant)/setup');
    } catch (caught) {
      setError(messageFor(caught, 'We could not create your business account. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScreenScroll contentStyle={styles.content}>
          <View style={styles.topRow}>
            <BrandMark wordmark={false} />
            <Link href="/sign-in" asChild>
              <Pressable accessibilityRole="link" hitSlop={8}>
                <Text style={styles.link}>Sign in</Text>
              </Pressable>
            </Link>
          </View>

          <View style={styles.head}>
            <Text style={styles.eyebrow}>For business</Text>
            <Text style={styles.title}>Open your studio on Neara</Text>
            <Text style={styles.body}>
              Reserve your page address and owner account now. You will add your location, services
              and weekly hours next, then publish when everything is ready.
            </Text>
          </View>

          <Card style={styles.card}>
            <TextField
              label="Business name"
              value={businessName}
              onChangeText={changeBusinessName}
              placeholder="Near Beauty Studio"
              autoCapitalize="words"
              maxLength={120}
            />

            <TextField
              label="Page address"
              value={slug}
              onChangeText={changeSlug}
              placeholder="near-beauty-studio"
              hint={`Your page becomes neara/${slug || 'your-studio'}. Lowercase letters, numbers and hyphens only.`}
              maxLength={60}
            />
            {slugState ? (
              <View style={styles.slugState}>
                {slugState.state === 'checking' ? (
                  <Text style={styles.slugChecking}>Checking availability…</Text>
                ) : slugState.state === 'available' ? (
                  <View style={styles.slugRow}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={styles.slugAvailable}>{slug} is available</Text>
                  </View>
                ) : (
                  <View style={styles.slugRow}>
                    <Ionicons name="alert-circle" size={16} color={colors.danger} />
                    <View style={styles.flex}>
                      <Text style={styles.slugTaken}>
                        {slug} is not available ({slugState.message})
                      </Text>
                      {slugState.suggestion ? (
                        <Pressable
                          accessibilityRole="button"
                          hitSlop={8}
                          onPress={() => {
                            setSlugTouched(true);
                            setSlug(slugState.suggestion ?? '');
                            scheduleSlugCheck(slugState.suggestion ?? '');
                          }}
                        >
                          <Text style={styles.slugSuggestion}>Use {slugState.suggestion}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                )}
              </View>
            ) : null}

            <TextField
              label="Your name"
              value={ownerName}
              onChangeText={setOwnerName}
              placeholder="Asha Menon"
              autoCapitalize="words"
              autoComplete="name"
              maxLength={120}
            />

            <TextField
              label="Work email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@studio.com"
              keyboardType="email-address"
              autoComplete="email"
            />

            <PasswordField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />

            <View style={styles.timezoneBlock}>
              <Text style={styles.fieldLabel}>Timezone</Text>
              <HorizontalChips>
                {TIMEZONES.map((zone) => (
                  <Chip
                    key={zone}
                    label={zone}
                    selected={timezone === zone}
                    onPress={() => setTimezone(zone)}
                  />
                ))}
              </HorizontalChips>
              <Text style={styles.timezoneHint}>Bookings and working hours use this timezone.</Text>
            </View>

            <Button label="Create business account" onPress={submit} loading={busy} />

            {error ? <Note tone="error">{error}</Note> : null}

            <Text style={styles.legal}>
              By creating a business account you confirm you are authorised to list this business and
              agree to Neara&apos;s{' '}
              <Text
                accessibilityRole="link"
                style={styles.legalLink}
                onPress={() => void openExternal(PRIVACY_URL)}
              >
                privacy policy
              </Text>{' '}
              and{' '}
              <Text
                accessibilityRole="link"
                style={styles.legalLink}
                onPress={() => void openExternal(TERMS_URL)}
              >
                acceptable use terms
              </Text>
              .
            </Text>
          </Card>

          <Button label="Back to sign in" variant="ghost" onPress={() => router.replace('/sign-in')} />
        </ScreenScroll>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: spacing.xl },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm },
  link: { ...typography.smallStrong, color: colors.accent },
  head: { gap: spacing.sm },
  eyebrow: { ...typography.eyebrow, color: colors.teal, textTransform: 'uppercase' },
  title: { ...typography.display, color: colors.ink },
  body: { ...typography.body, color: colors.muted },
  card: { gap: spacing.lg },
  slugState: { gap: 2 },
  slugRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  slugChecking: { ...typography.small, color: colors.muted },
  slugAvailable: { ...typography.small, color: colors.success },
  slugTaken: { ...typography.small, color: colors.danger },
  slugSuggestion: { ...typography.smallStrong, color: colors.accent, paddingTop: 2 },
  timezoneBlock: { gap: spacing.sm },
  fieldLabel: { ...typography.smallStrong, color: colors.ink },
  timezoneHint: { ...typography.small, color: colors.muted },
  legal: { ...typography.small, color: colors.muted, fontSize: 12 },
  legalLink: { ...typography.smallStrong, color: colors.accent, fontSize: 12 },
});
