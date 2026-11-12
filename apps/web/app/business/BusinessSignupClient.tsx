'use client';

import { CheckCircle2, Circle, LoaderCircle, MapPin, Scissors, Store, UsersRound } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { apiGet, apiPost } from '../lib/api';
import { adminGet, adminSend } from '../admin/lib/adminApi';
import { Note } from '../components/neara/primitives';

type StepKey = 'account' | 'business' | 'location' | 'services' | 'team' | 'review';

type Me = {
  user: {
    id: string;
    name: string;
    email: string | null;
    memberships: Array<{
      tenantId: string;
      role: string;
      tenant: { id: string; name: string; slug: string; status: string };
    }>;
  };
};

type SlugCheck = { slug: string; available: boolean; reason: string | null; suggestion?: string };

type OnboardingStatus = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: string;
    timezone: string | null;
    description: string | null;
    publicEmail: string | null;
    publicPhone: string | null;
    primaryCategory: { id: string; name: string; slug: string } | null;
  };
  steps: { profile: boolean; location: boolean; services: boolean; team: boolean; availability: boolean };
  missing: string[];
  ready: boolean;
  isActive: boolean;
};

type Category = { id: string; name: string; slug: string; description: string | null };
type LocationRow = {
  id: string;
  name: string;
  addressLine: string;
  locality: string;
  city: string;
  state: string | null;
  postalCode: string | null;
  latitude: string;
  longitude: string;
};
type ServiceRow = {
  id: string;
  name: string;
  slug: string;
  durationMinutes: number;
  displayPriceAmount: string | null;
  isActive: boolean;
};
type ExpertRow = {
  id: string;
  displayName: string;
  slug: string;
  shortBio: string | null;
  isActive: boolean;
  expertServices: Array<{ serviceId: string; service: { id: string; name: string } }>;
};
type AvailabilityRule = { id: string; dayOfWeek: number; startLocalTime: string; endLocalTime: string };
type GeocodeResult = {
  formattedAddress: string;
  latitude: number;
  longitude: number;
  locality?: string;
  city?: string;
  state?: string;
  postalCode?: string;
};

type SlugState = { state: 'checking' | 'available' | 'taken'; message?: string; suggestion?: string } | null;

const STEPS: Array<{ key: StepKey; label: string }> = [
  { key: 'account', label: 'Account' },
  { key: 'business', label: 'Business' },
  { key: 'location', label: 'Location' },
  { key: 'services', label: 'Services' },
  { key: 'team', label: 'Team & hours' },
  { key: 'review', label: 'Go live' },
];

const REVIEW_ROWS: Array<{ key: keyof OnboardingStatus['steps']; label: string; step: StepKey }> = [
  { key: 'profile', label: 'Business profile and category', step: 'business' },
  { key: 'location', label: 'Location with address', step: 'location' },
  { key: 'services', label: 'At least one service', step: 'services' },
  { key: 'team', label: 'Expert assigned to a service', step: 'team' },
  { key: 'availability', label: 'Weekly availability', step: 'team' },
];

const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Jakarta',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Australia/Sydney',
  'UTC',
];

const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function uniqueSlug(base: string, taken: string[], fallback: string) {
  const clean = slugify(base) || fallback;
  let candidate = clean;
  let index = 2;
  while (taken.includes(candidate)) {
    candidate = `${clean}-${index}`.slice(0, 60);
    index += 1;
  }
  return candidate;
}

function readError(error: unknown) {
  if (!(error instanceof Error) || !error.message) {
    return 'Something went wrong. Please try again.';
  }

  try {
    const payload = JSON.parse(error.message) as { message?: string | string[]; missing?: string[] };
    if (Array.isArray(payload.missing) && payload.missing.length > 0) {
      return `${payload.message ?? 'Finish the remaining setup'} — ${payload.missing.join(', ')}.`;
    }
    if (Array.isArray(payload.message)) {
      return payload.message.join('. ');
    }
    if (typeof payload.message === 'string' && payload.message) {
      return payload.message;
    }
  } catch {
    // The API returned plain text; fall through to the raw message.
  }

  return error.message;
}

function firstIncompleteStep(status: OnboardingStatus): StepKey {
  if (!status.steps.profile) return 'business';
  if (!status.steps.location) return 'location';
  if (!status.steps.services) return 'services';
  if (!status.steps.team) return 'team';
  if (!status.steps.availability) return 'team';
  return 'review';
}

export function BusinessSignupClient() {
  const [step, setStep] = useState<StepKey>('account');
  const [tenant, setTenant] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [setup, setSetup] = useState<OnboardingStatus | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [experts, setExperts] = useState<ExpertRow[]>([]);
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [availabilityExpertId, setAvailabilityExpertId] = useState('');
  const [availabilityDays, setAvailabilityDays] = useState<number[]>([1, 2, 3, 4, 5]);

  const [businessName, setBusinessName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugState, setSlugState] = useState<SlugState>(null);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(true);

  const slugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiGet<Me>('/api/admin/auth/me')
      .then(async (result) => {
        const draft = result.user.memberships.find((membership) => membership.tenant.status === 'draft');
        if (!draft || cancelled) {
          return;
        }
        setTenant({ id: draft.tenantId, name: draft.tenant.name, slug: draft.tenant.slug });
        const status = await hydrate(draft.tenantId).catch(() => null);
        if (status && !cancelled) {
          setStep(firstIncompleteStep(status));
        }
      })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });

    apiGet<Category[]>('/api/public/categories')
      .then((rows) => setCategories(rows))
      .catch(() => setCategories([]));

    return () => {
      cancelled = true;
      if (slugTimer.current) clearTimeout(slugTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!tenant || !availabilityExpertId) {
      setRules([]);
      return;
    }
    adminGet<AvailabilityRule[]>(`/api/admin/tenant/${tenant.id}/experts/${availabilityExpertId}/availability-rules`)
      .then((rows) => setRules(rows))
      .catch(() => setRules([]));
  }, [tenant, availabilityExpertId]);

  async function hydrate(tenantId: string) {
    const [status, locationRows, serviceRows, expertRows] = await Promise.all([
      adminGet<OnboardingStatus>(`/api/admin/tenant/${tenantId}/onboarding`),
      adminGet<LocationRow[]>(`/api/admin/tenant/${tenantId}/locations`),
      adminGet<ServiceRow[]>(`/api/admin/tenant/${tenantId}/services`),
      adminGet<ExpertRow[]>(`/api/admin/tenant/${tenantId}/experts`),
    ]);
    setSetup(status);
    setLocations(locationRows);
    setServices(serviceRows);
    setExperts(expertRows);
    setAvailabilityExpertId((current) => current || expertRows[0]?.id || '');
    return status;
  }

  async function refreshSetup() {
    if (!tenant) return null;
    const status = await adminGet<OnboardingStatus>(`/api/admin/tenant/${tenant.id}/onboarding`);
    setSetup(status);
    return status;
  }

  function scheduleSlugCheck(next: string) {
    if (slugTimer.current) clearTimeout(slugTimer.current);
    if (!next) {
      setSlugState(null);
      return;
    }
    setSlugState({ state: 'checking' });
    slugTimer.current = setTimeout(() => {
      apiGet<SlugCheck>(`/api/public/tenant-slug/check?slug=${encodeURIComponent(next)}`)
        .then((result) => {
          setSlugState({
            state: result.available ? 'available' : 'taken',
            message: result.reason === 'reserved' ? 'Reserved by Neara' : undefined,
            suggestion: result.suggestion,
          });
        })
        .catch(() => setSlugState(null));
    }, 350);
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

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await apiPost<{ tenant: { id: string; name: string; slug: string } }>('/api/public/tenant-signup', {
        businessName: form.get('businessName'),
        slug: form.get('slug'),
        ownerName: form.get('ownerName'),
        email: form.get('email'),
        password: form.get('password'),
        timezone: form.get('timezone') || undefined,
      });
      setTenant(result.tenant);
      await hydrate(result.tenant.id);
      setStep('business');
      setNotice(`Your page address /${result.tenant.slug} is reserved.`);
    } catch (failure) {
      setError(readError(failure));
    } finally {
      setBusy(false);
    }
  }

  async function saveBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenant) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await adminSend(`/api/admin/tenant/${tenant.id}/profile`, 'PATCH', {
        name: form.get('name'),
        primaryCategoryId: form.get('primaryCategoryId'),
        timezone: form.get('timezone'),
        description: form.get('description') || undefined,
        publicEmail: form.get('publicEmail') || undefined,
        publicPhone: form.get('publicPhone') || undefined,
      });
      await hydrate(tenant.id);
      setStep('location');
    } catch (failure) {
      setError(readError(failure));
    } finally {
      setBusy(false);
    }
  }

  async function findCoordinates(form: HTMLFormElement) {
    if (!tenant) return;
    const data = new FormData(form);
    const address = ['addressLine', 'locality', 'city', 'state', 'postalCode']
      .map((field) => String(data.get(field) ?? '').trim())
      .filter(Boolean)
      .join(', ');

    if (!address) {
      setError('Add the street address before looking up coordinates.');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await adminGet<GeocodeResult>(
        `/api/admin/tenant/${tenant.id}/geocode?address=${encodeURIComponent(address)}`,
      );
      const setInput = (name: string, value?: string | number) => {
        const input = form.elements.namedItem(name) as HTMLInputElement | null;
        if (input && value !== undefined && value !== null && value !== '') input.value = String(value);
      };
      setInput('latitude', result.latitude);
      setInput('longitude', result.longitude);
      setInput('locality', result.locality);
      setInput('city', result.city);
      setInput('state', result.state);
      setInput('postalCode', result.postalCode);
      setNotice(`Coordinates found for ${result.formattedAddress}`);
    } catch {
      setError('We could not find coordinates for that address. Enter latitude and longitude manually.');
    } finally {
      setBusy(false);
    }
  }

  async function saveLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenant) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await adminSend(`/api/admin/tenant/${tenant.id}/locations/primary`, 'POST', {
        name: form.get('name'),
        addressLine: form.get('addressLine'),
        locality: form.get('locality'),
        city: form.get('city'),
        state: form.get('state') || undefined,
        postalCode: form.get('postalCode') || undefined,
        latitude: Number(form.get('latitude')),
        longitude: Number(form.get('longitude')),
      });
      await hydrate(tenant.id);
      setStep('services');
    } catch (failure) {
      setError(readError(failure));
    } finally {
      setBusy(false);
    }
  }

  async function addService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenant) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get('name') ?? '').trim();
    if (services.some((service) => service.name.toLowerCase() === name.toLowerCase())) {
      setError('A service with this name already exists.');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const price = String(form.get('displayPriceAmount') ?? '').trim();
      await adminSend(`/api/admin/tenant/${tenant.id}/services`, 'POST', {
        name,
        slug: uniqueSlug(name, services.map((service) => service.slug), 'service'),
        durationMinutes: Number(form.get('durationMinutes')),
        displayPriceAmount: price ? Number(price) : undefined,
      });
      formElement.reset();
      await hydrate(tenant.id);
      setNotice(`${name} added.`);
    } catch (failure) {
      setError(readError(failure));
    } finally {
      setBusy(false);
    }
  }

  async function addExpert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenant) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const displayName = String(form.get('displayName') ?? '').trim();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const expert = await adminSend<ExpertRow>(`/api/admin/tenant/${tenant.id}/experts`, 'POST', {
        displayName,
        slug: uniqueSlug(displayName, experts.map((row) => row.slug), 'expert'),
        shortBio: form.get('shortBio') || undefined,
      });

      const serviceIds = services.filter((service) => service.isActive).map((service) => service.id);
      if (serviceIds.length > 0) {
        await adminSend(`/api/admin/tenant/${tenant.id}/experts/${expert.id}/services`, 'POST', { serviceIds });
      }

      formElement.reset();
      await hydrate(tenant.id);
      setAvailabilityExpertId(expert.id);
      setNotice(`${displayName} added${serviceIds.length > 0 ? ' and assigned to your services' : ''}.`);
    } catch (failure) {
      setError(readError(failure));
    } finally {
      setBusy(false);
    }
  }

  async function addAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenant || !availabilityExpertId) {
      setError('Add an expert before setting availability.');
      return;
    }
    const form = new FormData(event.currentTarget);
    const startLocalTime = String(form.get('startLocalTime') ?? '');
    const endLocalTime = String(form.get('endLocalTime') ?? '');
    if (availabilityDays.length === 0) {
      setError('Choose at least one working day.');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');
    try {
      for (const dayOfWeek of availabilityDays) {
        await adminSend(`/api/admin/tenant/${tenant.id}/experts/${availabilityExpertId}/availability-rules`, 'POST', {
          dayOfWeek,
          startLocalTime,
          endLocalTime,
        });
      }
      await hydrate(tenant.id);
      setNotice('Weekly availability saved.');
    } catch (failure) {
      setError(readError(failure));
    } finally {
      setBusy(false);
    }
  }

  async function toggleDay(day: number) {
    setAvailabilityDays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day],
    );
  }

  async function goLive() {
    if (!tenant) return;
    setBusy(true);
    setError('');
    try {
      await adminSend(`/api/admin/tenant/${tenant.id}/onboarding/complete`, 'POST', {});
      window.location.href = `/admin/tenant/${tenant.id}`;
    } catch (failure) {
      setError(readError(failure));
      await refreshSetup().catch(() => null);
      setBusy(false);
    }
  }

  useEffect(() => {
    if (step === 'review' && tenant) {
      refreshSetup().catch(() => null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, tenant]);

  function stepState(key: StepKey) {
    if (key === 'account') {
      return tenant ? 'done' : 'todo';
    }
    if (!setup) {
      return 'todo';
    }
    const map: Record<Exclude<StepKey, 'account' | 'review'>, boolean> = {
      business: setup.steps.profile,
      location: setup.steps.location,
      services: setup.steps.services,
      team: setup.steps.team && setup.steps.availability,
    };
    if (key === 'review') {
      return setup.isActive ? 'done' : setup.ready ? 'current' : 'todo';
    }
    return map[key] ? 'done' : 'todo';
  }

  const currentIndex = STEPS.findIndex((item) => item.key === step);
  const primaryLocation = locations[0];
  const activeServices = services.filter((service) => service.isActive);
  const selectedExpert = experts.find((expert) => expert.id === availabilityExpertId);
  const canGoLive = Boolean(setup?.ready) && !setup?.isActive;

  return (
    <main className="n-main n-wizard-page">
      <div className="n-wizard">
        <header className="n-wizard-head">
          <a className="n-brand" href="/" aria-label="Neara home">
            <span className="n-brand-mark" aria-hidden="true">
              N
            </span>
            <span>Neara</span>
          </a>
          <p className="n-eyebrow">For business</p>
          <h1 className="n-display">Open your studio on Neara</h1>
          <p className="n-body">
            Create your account, reserve your page address and publish everything customers need to book — in six
            short steps. You can come back and finish any time.
          </p>
        </header>

        <ol className="n-stepper" aria-label="Onboarding steps">
          {STEPS.map((item, index) => {
            const state = stepState(item.key);
            return (
              <li key={item.key}>
                <button
                  type="button"
                  data-state={state}
                  aria-current={step === item.key ? 'step' : undefined}
                  disabled={!tenant || (state === 'todo' && index > currentIndex + 1)}
                  onClick={() => {
                    setError('');
                    setNotice('');
                    setStep(item.key);
                  }}
                >
                  <span aria-hidden="true">{state === 'done' ? '✓' : index + 1}</span>
                  {item.label}
                </button>
              </li>
            );
          })}
        </ol>

        {error ? <Note tone="error">{error}</Note> : null}
        {notice ? <Note tone="success">{notice}</Note> : null}

        <section className="n-auth-card n-wizard-card">
          {restoring && !tenant ? (
            <p className="n-wizard-hint">
              <LoaderCircle aria-hidden="true" size={16} /> Checking your account…
            </p>
          ) : null}

          {step === 'account' && !tenant ? (
            <form className="n-auth-form" onSubmit={createAccount}>
              <div>
                <p className="n-eyebrow">Step 1 of 6</p>
                <h2 className="n-wizard-title">Account &amp; page address</h2>
                <p className="n-wizard-hint">
                  Your page address is reserved the moment you create the account. It becomes neara.co.in/
                  <strong>{slug || 'your-studio'}</strong>.
                </p>
              </div>

              <label className="n-field">
                <span className="n-field-label">Business name</span>
                <input
                  className="n-input"
                  name="businessName"
                  value={businessName}
                  onChange={(event) => changeBusinessName(event.target.value)}
                  placeholder="Near Beauty Studio"
                  minLength={2}
                  maxLength={120}
                  required
                />
              </label>

              <label className="n-field">
                <span className="n-field-label">Page address</span>
                <input
                  className="n-input"
                  name="slug"
                  value={slug}
                  onChange={(event) => changeSlug(event.target.value)}
                  placeholder="near-beauty-studio"
                  pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                  minLength={2}
                  maxLength={60}
                  required
                />
                {slugState ? (
                  <span className="n-wizard-slug" data-state={slugState.state}>
                    {slugState.state === 'checking'
                      ? 'Checking availability…'
                      : slugState.state === 'available'
                        ? `${slug} is available`
                        : `${slug} is not available${slugState.message ? ` (${slugState.message})` : ''}`}
                    {slugState.state === 'taken' && slugState.suggestion ? (
                      <button
                        type="button"
                        className="n-wizard-slug-suggestion"
                        onClick={() => {
                          setSlug(slugState.suggestion ?? '');
                          setSlugTouched(true);
                          scheduleSlugCheck(slugState.suggestion ?? '');
                        }}
                      >
                        Use {slugState.suggestion}
                      </button>
                    ) : null}
                  </span>
                ) : (
                  <span className="n-hint">Lowercase letters, numbers and hyphens only.</span>
                )}
              </label>

              <div className="n-wizard-row">
                <label className="n-field">
                  <span className="n-field-label">Your name</span>
                  <input
                    className="n-input"
                    name="ownerName"
                    placeholder="Asha Menon"
                    autoComplete="name"
                    minLength={2}
                    required
                  />
                </label>
                <label className="n-field">
                  <span className="n-field-label">Timezone</span>
                  <select className="n-select" name="timezone" defaultValue="Asia/Kolkata">
                    {TIMEZONES.map((zone) => (
                      <option value={zone} key={zone}>
                        {zone}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="n-field">
                <span className="n-field-label">Work email</span>
                <input
                  className="n-input"
                  name="email"
                  type="email"
                  placeholder="you@studio.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label className="n-field">
                <span className="n-field-label">Password</span>
                <input
                  className="n-input"
                  name="password"
                  type="password"
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>

              <div className="n-wizard-actions">
                <button type="submit" className="n-btn" disabled={busy}>
                  {busy ? <LoaderCircle aria-hidden="true" size={17} /> : null}
                  {busy ? 'Reserving…' : 'Create account & reserve'}
                </button>
              </div>
              <p className="n-auth-alt">
                Already listed on Neara? <a className="n-link" href="/admin/login">Sign in</a>
              </p>
            </form>
          ) : null}

          {step === 'business' && tenant ? (
            <form className="n-auth-form" onSubmit={saveBusiness}>
              <div>
                <p className="n-eyebrow">Step 2 of 6</p>
                <h2 className="n-wizard-title">Business profile</h2>
                <p className="n-wizard-hint">
                  This is what customers see on your page at /{tenant.slug}. Category and timezone are required
                  before you can go live.
                </p>
              </div>

              <label className="n-field">
                <span className="n-field-label">Business name</span>
                <input
                  className="n-input"
                  name="name"
                  defaultValue={setup?.tenant.name ?? tenant.name}
                  minLength={2}
                  maxLength={120}
                  required
                />
              </label>

              <div className="n-wizard-row">
                <label className="n-field">
                  <span className="n-field-label">Primary category</span>
                  <select
                    className="n-select"
                    name="primaryCategoryId"
                    defaultValue={setup?.tenant.primaryCategory?.id ?? ''}
                    required
                  >
                    <option value="" disabled>
                      Choose a category
                    </option>
                    {categories.map((category) => (
                      <option value={category.id} key={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="n-field">
                  <span className="n-field-label">Timezone</span>
                  <select className="n-select" name="timezone" defaultValue={setup?.tenant.timezone ?? 'Asia/Kolkata'} required>
                    {TIMEZONES.map((zone) => (
                      <option value={zone} key={zone}>
                        {zone}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="n-field">
                <span className="n-field-label">About your business</span>
                <textarea
                  className="n-textarea"
                  name="description"
                  defaultValue={setup?.tenant.description ?? ''}
                  placeholder="What you offer, the experience customers can expect, and anything they should know before booking."
                  maxLength={1000}
                  rows={4}
                />
              </label>

              <div className="n-wizard-row">
                <label className="n-field">
                  <span className="n-field-label">Public email</span>
                  <input
                    className="n-input"
                    name="publicEmail"
                    type="email"
                    defaultValue={setup?.tenant.publicEmail ?? ''}
                    placeholder="hello@studio.com"
                  />
                </label>
                <label className="n-field">
                  <span className="n-field-label">Public phone</span>
                  <input
                    className="n-input"
                    name="publicPhone"
                    defaultValue={setup?.tenant.publicPhone ?? ''}
                    placeholder="+919876543210"
                    maxLength={32}
                  />
                </label>
              </div>

              <div className="n-wizard-actions">
                <button type="submit" className="n-btn" disabled={busy}>
                  {busy ? <LoaderCircle aria-hidden="true" size={17} /> : null}
                  {busy ? 'Saving…' : 'Save & continue'}
                </button>
              </div>
            </form>
          ) : null}

          {step === 'location' && tenant ? (
            <form className="n-auth-form" onSubmit={saveLocation}>
              <div>
                <p className="n-eyebrow">Step 3 of 6</p>
                <h2 className="n-wizard-title">Where customers visit</h2>
                <p className="n-wizard-hint">
                  Your primary location is shown on your page and used to match you with nearby customers.
                </p>
              </div>

              <label className="n-field">
                <span className="n-field-label">Location name</span>
                <input
                  className="n-input"
                  name="name"
                  defaultValue={primaryLocation?.name ?? 'Main studio'}
                  minLength={2}
                  maxLength={120}
                  required
                />
              </label>

              <label className="n-field">
                <span className="n-field-label">Street address</span>
                <input
                  className="n-input"
                  name="addressLine"
                  defaultValue={primaryLocation?.addressLine ?? ''}
                  placeholder="12 MG Road"
                  minLength={3}
                  maxLength={240}
                  required
                />
              </label>

              <div className="n-wizard-row">
                <label className="n-field">
                  <span className="n-field-label">Locality</span>
                  <input
                    className="n-input"
                    name="locality"
                    defaultValue={primaryLocation?.locality ?? ''}
                    placeholder="Koregaon Park"
                    minLength={2}
                    required
                  />
                </label>
                <label className="n-field">
                  <span className="n-field-label">City</span>
                  <input className="n-input" name="city" defaultValue={primaryLocation?.city ?? 'Pune'} minLength={2} required />
                </label>
              </div>

              <div className="n-wizard-row">
                <label className="n-field">
                  <span className="n-field-label">State</span>
                  <input className="n-input" name="state" defaultValue={primaryLocation?.state ?? ''} />
                </label>
                <label className="n-field">
                  <span className="n-field-label">Postal code</span>
                  <input className="n-input" name="postalCode" defaultValue={primaryLocation?.postalCode ?? ''} />
                </label>
              </div>

              <div className="n-wizard-row">
                <label className="n-field">
                  <span className="n-field-label">Latitude</span>
                  <input
                    className="n-input"
                    name="latitude"
                    type="number"
                    step="0.000001"
                    defaultValue={primaryLocation?.latitude ?? ''}
                    required
                  />
                </label>
                <label className="n-field">
                  <span className="n-field-label">Longitude</span>
                  <input
                    className="n-input"
                    name="longitude"
                    type="number"
                    step="0.000001"
                    defaultValue={primaryLocation?.longitude ?? ''}
                    required
                  />
                </label>
              </div>

              <div className="n-wizard-actions">
                <button
                  type="button"
                  className="n-btn n-btn-secondary"
                  disabled={busy}
                  onClick={(event) => {
                    const form = event.currentTarget.form;
                    if (form) void findCoordinates(form);
                  }}
                >
                  <MapPin aria-hidden="true" size={16} />
                  Find coordinates
                </button>
                <button type="submit" className="n-btn" disabled={busy}>
                  {busy ? <LoaderCircle aria-hidden="true" size={17} /> : null}
                  {busy ? 'Saving…' : 'Save & continue'}
                </button>
              </div>
            </form>
          ) : null}

          {step === 'services' && tenant ? (
            <div className="n-auth-form">
              <div>
                <p className="n-eyebrow">Step 4 of 6</p>
                <h2 className="n-wizard-title">Services you offer</h2>
                <p className="n-wizard-hint">Add at least one bookable service with a duration. Prices are optional.</p>
              </div>

              <ul className="n-wizard-list">
                {services.length === 0 ? <li>No services yet — add your first one below.</li> : null}
                {services.map((service) => (
                  <li key={service.id}>
                    <span>
                      <strong>
                        <Scissors aria-hidden="true" size={14} /> {service.name}
                      </strong>
                      <small>{service.durationMinutes} minutes</small>
                    </span>
                    <small>
                      {service.displayPriceAmount ? `₹${service.displayPriceAmount}` : 'No price'}
                      {service.isActive ? '' : ' · inactive'}
                    </small>
                  </li>
                ))}
              </ul>

              <form className="n-auth-form" onSubmit={addService}>
                <div className="n-wizard-row">
                  <label className="n-field">
                    <span className="n-field-label">Service name</span>
                    <input className="n-input" name="name" placeholder="Signature haircut" minLength={2} required />
                  </label>
                  <label className="n-field">
                    <span className="n-field-label">Duration (minutes)</span>
                    <input className="n-input" name="durationMinutes" type="number" min={5} max={480} defaultValue={45} required />
                  </label>
                </div>
                <label className="n-field">
                  <span className="n-field-label">Price in INR (optional)</span>
                  <input className="n-input" name="displayPriceAmount" type="number" min={0} placeholder="1200" />
                </label>
                <div className="n-wizard-actions">
                  <button type="submit" className="n-btn n-btn-secondary" disabled={busy}>
                    Add service
                  </button>
                  <button
                    type="button"
                    className="n-btn"
                    disabled={busy || activeServices.length === 0}
                    onClick={() => setStep('team')}
                  >
                    Continue
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {step === 'team' && tenant ? (
            <div className="n-auth-form">
              <div>
                <p className="n-eyebrow">Step 5 of 6</p>
                <h2 className="n-wizard-title">Who delivers the work</h2>
                <p className="n-wizard-hint">
                  Add the expert customers can book. New experts are automatically assigned to your active services.
                </p>
              </div>

              <ul className="n-wizard-list">
                {experts.length === 0 ? <li>No experts yet — add the first one below.</li> : null}
                {experts.map((expert) => (
                  <li key={expert.id}>
                    <span>
                      <strong>
                        <UsersRound aria-hidden="true" size={14} /> {expert.displayName}
                      </strong>
                      <small>
                        {expert.expertServices.length > 0
                          ? expert.expertServices.map((assignment) => assignment.service.name).join(', ')
                          : 'No services assigned'}
                      </small>
                    </span>
                    <small>{expert.isActive ? 'Active' : 'Inactive'}</small>
                  </li>
                ))}
              </ul>

              <form className="n-auth-form" onSubmit={addExpert}>
                <div className="n-wizard-row">
                  <label className="n-field">
                    <span className="n-field-label">Expert name</span>
                    <input className="n-input" name="displayName" placeholder="Ananya Rao" minLength={2} required />
                  </label>
                  <label className="n-field">
                    <span className="n-field-label">Short bio (optional)</span>
                    <input className="n-input" name="shortBio" placeholder="Senior stylist, 8 years" maxLength={500} />
                  </label>
                </div>
                <div className="n-wizard-actions">
                  <button type="submit" className="n-btn n-btn-secondary" disabled={busy || activeServices.length === 0}>
                    Add expert
                  </button>
                </div>
                {activeServices.length === 0 ? (
                  <p className="n-wizard-hint">Add a service before adding your team.</p>
                ) : null}
              </form>

              <div className="n-divider">Weekly availability</div>

              <form className="n-auth-form" onSubmit={addAvailability}>
                <label className="n-field">
                  <span className="n-field-label">Expert</span>
                  <select
                    className="n-select"
                    value={availabilityExpertId}
                    onChange={(event) => setAvailabilityExpertId(event.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Choose an expert
                    </option>
                    {experts.map((expert) => (
                      <option value={expert.id} key={expert.id}>
                        {expert.displayName}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="n-field">
                  <span className="n-field-label">Working days</span>
                  <div className="n-wizard-days">
                    {DAYS.map((day) => (
                      <label className="n-wizard-day" key={day.value}>
                        <input
                          type="checkbox"
                          checked={availabilityDays.includes(day.value)}
                          onChange={() => void toggleDay(day.value)}
                        />
                        {day.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="n-wizard-row">
                  <label className="n-field">
                    <span className="n-field-label">Opens</span>
                    <input className="n-input" name="startLocalTime" type="time" defaultValue="10:00" required />
                  </label>
                  <label className="n-field">
                    <span className="n-field-label">Closes</span>
                    <input className="n-input" name="endLocalTime" type="time" defaultValue="18:00" required />
                  </label>
                </div>

                <ul className="n-wizard-list">
                  {rules.length === 0 ? (
                    <li>
                      <span>
                        <strong>No hours yet</strong>
                        <small>{selectedExpert ? `${selectedExpert.displayName} cannot be booked until hours are set.` : 'Add an expert first.'}</small>
                      </span>
                    </li>
                  ) : null}
                  {rules.map((rule) => (
                    <li key={rule.id}>
                      <span>
                        <strong>{DAYS.find((day) => day.value === rule.dayOfWeek)?.label ?? rule.dayOfWeek}</strong>
                        <small>
                          {rule.startLocalTime} – {rule.endLocalTime}
                        </small>
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="n-wizard-actions">
                  <button type="submit" className="n-btn n-btn-secondary" disabled={busy || !availabilityExpertId}>
                    Save hours
                  </button>
                  <button
                    type="button"
                    className="n-btn"
                    disabled={busy || !setup?.steps.availability}
                    onClick={() => setStep('review')}
                  >
                    Continue
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {step === 'review' && tenant ? (
            <div className="n-auth-form">
              <div>
                <p className="n-eyebrow">Step 6 of 6</p>
                <h2 className="n-wizard-title">Ready to go live</h2>
                <p className="n-wizard-hint">
                  Everything below must be complete before your page accepts bookings on Neara.
                </p>
              </div>

              <ul className="n-wizard-check">
                {REVIEW_ROWS.map((row) => {
                  const done = Boolean(setup?.steps[row.key]);
                  return (
                    <li key={row.key} data-done={done}>
                      <span className="n-wizard-check-label">
                        {done ? (
                          <CheckCircle2 aria-hidden="true" size={18} className="n-wizard-ok" />
                        ) : (
                          <Circle aria-hidden="true" size={18} className="n-wizard-todo" />
                        )}
                        {row.label}
                      </span>
                      <button type="button" className="n-btn n-btn-quiet n-btn-sm" onClick={() => setStep(row.step)}>
                        {done ? 'Edit' : 'Fix'}
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="n-identity">
                <span className="n-avatar-initials" aria-hidden="true">
                  <Store size={18} />
                </span>
                <div>
                  <strong>{setup?.tenant.name ?? tenant.name}</strong>
                  <small>
                    /{tenant.slug}
                    {setup?.tenant.primaryCategory ? ` · ${setup.tenant.primaryCategory.name}` : ''}
                    {setup?.tenant.timezone ? ` · ${setup.tenant.timezone}` : ''}
                  </small>
                </div>
              </div>

              {setup?.isActive ? (
                <p className="n-wizard-hint">Your business is already live.</p>
              ) : setup && setup.missing.length > 0 ? (
                <p className="n-wizard-hint">Still missing: {setup.missing.join('; ')}.</p>
              ) : null}

              <div className="n-wizard-actions">
                <button type="button" className="n-btn n-btn-secondary" onClick={() => void refreshSetup()} disabled={busy}>
                  Refresh checklist
                </button>
                {setup?.isActive ? (
                  <a className="n-btn" href={`/admin/tenant/${tenant.id}`}>
                    Open workspace
                  </a>
                ) : (
                  <button type="button" className="n-btn" onClick={() => void goLive()} disabled={busy || !canGoLive}>
                    {busy ? <LoaderCircle aria-hidden="true" size={17} /> : null}
                    {busy ? 'Publishing…' : 'Go live'}
                  </button>
                )}
              </div>
            </div>
          ) : null}

          {tenant && step !== 'account' ? (
            <p className="n-auth-alt">
              Signed in as the owner of {tenant.name}. <a className="n-link" href={`/admin/tenant/${tenant.id}`}>Open workspace</a>
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
