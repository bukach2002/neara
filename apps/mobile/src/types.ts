export type TenantStatus = 'draft' | 'active' | 'inactive' | 'suspended';
export type SlugCheck = { slug: string; available: boolean; reason: string | null; suggestion?: string };

export type TenantSignupResponse = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    bookingPrefix: string;
    status: TenantStatus;
  };
  user: { id: string; name: string; email: string | null };
  nextStep: string;
};
export type TenantRole = 'owner' | 'admin' | 'staff';
export type BookingStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show';

export type TenantSummary = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus | string;
};

export type Membership = {
  tenantId: string;
  role: TenantRole | string;
  tenant: TenantSummary;
};

export type SessionUser = {
  id: string;
  name: string;
  email: string | null;
  mobileNumber: string | null;
  platformRole: 'none' | 'platform_admin';
  memberships: Membership[];
};

export type CustomerAuthResponse = {
  user: {
    id: string;
    name: string;
    email: string | null;
    mobileNumber: string | null;
  };
  trustedDevice?: boolean;
  expiresAt?: string;
};

export type AdminLoginResponse = {
  user: SessionUser;
  csrfToken: string;
};

export type AdminMeResponse = {
  sessionId: string;
  user: SessionUser;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive?: boolean;
  _count?: { tenants: number };
};

export type SearchTenant = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  category: { id: string; name: string; slug: string } | null;
  location: {
    id: string;
    name: string;
    addressLine: string;
    locality: string;
    city: string;
  } | null;
  services: Array<{
    id: string;
    name: string;
    durationMinutes: number;
    displayPriceAmount: string | null;
    displayPriceCurrency: string | null;
  }>;
  distanceKm: number | null;
  availabilityState: string;
  counts?: { experts: number; services: number };
};

export type SearchTenantsResponse = {
  items: SearchTenant[];
  meta: { radiusKm: number; distanceUnit: string; launchCountry: string };
};

export type PublicService = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  durationMinutes: number;
  displayPriceAmount: string | null;
  displayPriceCurrency: string | null;
  expertServices: Array<{
    expert: {
      id: string;
      displayName: string;
      shortBio: string | null;
      photoUrl: string | null;
    };
  }>;
};

export type PublicExpert = {
  id: string;
  displayName: string;
  shortBio: string | null;
  photoUrl: string | null;
  expertServices: Array<{
    service: { id: string; name: string; durationMinutes: number };
  }>;
};

export type TenantDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  timezone: string;
  status: TenantStatus;
  primaryCategory: { id: string; name: string; slug: string } | null;
  locations: Array<{
    id: string;
    name: string;
    addressLine: string;
    locality: string;
    city: string;
    state: string | null;
    postalCode: string | null;
    isPrimary: boolean;
  }>;
  services: PublicService[];
  experts: PublicExpert[];
};

export type AvailableSlot = {
  startsAt: string;
  endsAt: string;
  displayTime: string;
  expert: {
    id: string;
    displayName: string;
    shortBio: string | null;
    photoUrl: string | null;
  };
};

export type AvailableSlotsResponse = {
  items: AvailableSlot[];
  meta: {
    timezone: string;
    slotIntervalMinutes: number;
    minimumNoticeHours: number;
    advanceBookingDays: number;
  };
};

export type BookingRecord = {
  id: string;
  bookingReference: string;
  status: BookingStatus;
  startsAt: string;
  endsAt: string;
  timezone: string;
  displayTimeSnapshot: string;
  tenantNameSnapshot: string;
  locationNameSnapshot: string;
  locationAddressSnapshot: string;
  serviceNameSnapshot: string;
  serviceDurationSnapshot: number;
  servicePriceSnapshot: string | null;
  serviceCurrencySnapshot: string | null;
  expertDisplayNameSnapshot: string;
  customerNameSnapshot: string;
  customerPhoneSnapshot: string | null;
  customerEmailSnapshot: string | null;
  customerNote: string | null;
  createdAt: string;
  cancelledAt?: string | null;
  completedAt?: string | null;
  noShowAt?: string | null;
  service?: { id: string; name: string };
  expert?: { id: string; displayName: string };
  location?: { id: string; name: string; locality: string };
  customer?: { id: string; name: string; phone: string | null; email: string | null };
  tenant?: TenantSummary;
};

export type BookingListResponse = {
  items: BookingRecord[];
  total: number;
  take: number;
  skip: number;
};

export type CreateBookingInput = {
  serviceId: string;
  expertId?: string;
  startsAt: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerNote?: string;
  consentAccepted: boolean;
};

export type TenantDashboard = {
  bookingsToday: number;
  upcomingBookings: number;
  confirmedBookings: number;
  cancelledBookings: number;
};

export type OnboardingStatus = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: TenantStatus;
    timezone: string | null;
    description: string | null;
    publicEmail: string | null;
    publicPhone: string | null;
    primaryCategory: { id: string; name: string; slug: string } | null;
  };
  steps: Record<string, boolean>;
  missing: string[];
  ready: boolean;
  isActive: boolean;
};

export type TenantProfile = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  timezone: string | null;
  bookingPrefix: string;
  description: string | null;
  publicEmail: string | null;
  publicPhone: string | null;
  primaryCategory: { id: string; name: string; slug: string } | null;
};

export type TenantLocation = {
  id: string;
  name: string;
  addressLine: string;
  locality: string;
  city: string;
  state: string | null;
  postalCode: string | null;
  latitude: string;
  longitude: string;
  isPrimary: boolean;
  isActive: boolean;
};

export type GeocodeResult = {
  formattedAddress: string;
  latitude: number;
  longitude: number;
  locality?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
};

export type AvailabilityRule = {
  id: string;
  dayOfWeek: number;
  startLocalTime: string;
  endLocalTime: string;
  isActive: boolean;
};

export type TenantService = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  durationMinutes: number;
  displayPriceAmount: string | null;
  displayPriceCurrency: string | null;
  isActive: boolean;
  isPublic: boolean;
};

export type TenantExpert = {
  id: string;
  displayName: string;
  slug: string;
  shortBio: string | null;
  photoUrl: string | null;
  isActive: boolean;
  expertServices: Array<{ id: string; serviceId: string; service: { id: string; name: string } }>;
};

export type PlatformTenant = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  timezone: string | null;
  bookingPrefix: string;
  description: string | null;
  publicEmail: string | null;
  publicPhone: string | null;
  createdAt: string;
  primaryCategory: { id: string; name: string } | null;
  _count: {
    locations?: number;
    services: number;
    experts: number;
    bookings: number;
    memberships: number;
    auditLogs?: number;
    notificationLogs?: number;
  };
  locations?: Array<{
    id: string;
    name: string;
    addressLine: string;
    locality: string;
    city: string;
    isActive: boolean;
    isPrimary: boolean;
  }>;
  services?: Array<{ id: string; name: string; isActive: boolean; isPublic: boolean; durationMinutes: number }>;
  experts?: Array<{ id: string; displayName: string; isActive: boolean }>;
  memberships?: Array<{
    id: string;
    role: TenantRole | string;
    user: { id: string; name: string; email: string | null };
  }>;
};

export type AuditLogEntry = {
  id: string;
  action: string;
  summary: string;
  entityType: string;
  createdAt: string;
  tenant: { id: string; name: string; slug: string } | null;
  actor: { id: string; name: string; email: string | null } | null;
};

export type NotificationLogEntry = {
  id: string;
  templateKey: string;
  channel: string;
  provider: string | null;
  status: string;
  recipientEmail: string | null;
  errorMessage: string | null;
  attempts: number;
  createdAt: string;
  tenant: { id: string; name: string; slug: string } | null;
};

export type LogListResponse<T> = {
  items: T[];
  total: number;
  take: number;
  skip: number;
};
