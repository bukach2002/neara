/** Shared option lists for the business signup and setup flow. */

export const TIMEZONES = [
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
] as const;

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/** Matches the API dayOfWeek contract: 0 Sunday through 6 Saturday. */
export const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
] as const;

export function weekdayLabel(dayOfWeek: number) {
  return WEEKDAYS.find((day) => day.value === dayOfWeek)?.label ?? String(dayOfWeek);
}

/** Page address and expert/service slugs share the API pattern. */
export function slugify(value: string) {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function uniqueSlug(base: string, taken: string[], fallback: string) {
  const clean = slugify(base) || fallback;
  let candidate = clean;
  let index = 2;
  while (taken.includes(candidate)) {
    candidate = `${clean}-${index}`.slice(0, 60);
    index += 1;
  }
  return candidate;
}
