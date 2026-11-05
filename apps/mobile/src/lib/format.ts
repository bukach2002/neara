import type { BookingStatus, TenantStatus } from '@/types';

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

export function titleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatDateTime(iso: string, timezone?: string | null) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  try {
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export function formatTime(iso: string, timezone?: string | null) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  try {
    return new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(date);
  } catch {
    return date.toLocaleTimeString();
  }
}

export function formatLogTimestamp(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatMoney(amount: string | null, currency: string | null) {
  if (amount === null) {
    return null;
  }
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) {
    return `${currency ?? ''} ${amount}`.trim();
  }
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency ?? 'INR',
      maximumFractionDigits: 0,
    }).format(numeric);
  } catch {
    return `${currency ?? 'INR'} ${numeric}`;
  }
}

export type BadgeTone = 'neutral' | 'accent' | 'teal' | 'success' | 'warning' | 'danger' | 'violet';

export function bookingStatusTone(status: BookingStatus | string): BadgeTone {
  switch (status) {
    case 'confirmed':
      return 'teal';
    case 'completed':
      return 'success';
    case 'cancelled':
      return 'danger';
    case 'no_show':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function tenantStatusTone(status: TenantStatus | string): BadgeTone {
  switch (status) {
    case 'active':
      return 'success';
    case 'draft':
      return 'accent';
    case 'inactive':
      return 'neutral';
    case 'suspended':
      return 'danger';
    default:
      return 'neutral';
  }
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** ISO date key for "today" in the tenant's IANA timezone. */
export function todayKeyInTimezone(timezone: string): string {
  try {
    const formatted = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
      return formatted;
    }
  } catch {
    // Unknown timezone: fall back to the device day below.
  }
  return deviceDateKey(0);
}

export function deviceDateKey(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function addDaysToDateKey(dateKey: string, offsetDays: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + offsetDays));
  return date.toISOString().slice(0, 10);
}

export function dateKeyParts(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  return {
    weekday: WEEKDAYS[date.getUTCDay()] ?? '',
    day: date.getUTCDate(),
    month: MONTHS[date.getUTCMonth()] ?? '',
    isToday: dateKey === deviceDateKey(0),
  };
}

export function slotTimeRange(slot: { startsAt: string; endsAt: string }, timezone?: string | null) {
  return `${formatTime(slot.startsAt, timezone)} – ${formatTime(slot.endsAt, timezone)}`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
