export function formatPrice(amount: string | null, currency: string | null): string | null {
  if (!amount) return null;
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  const formatted = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
  const code = (currency ?? 'INR').toUpperCase();
  return code === 'INR' ? `₹${formatted}` : `${code} ${formatted}`;
}

export function formatDuration(minutes: number): string {
  return `${minutes} min`;
}

export function formatDistance(distanceKm: number | null): string | null {
  if (distanceKm === null || !Number.isFinite(distanceKm)) return null;
  return `${distanceKm.toFixed(1)} km away`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'N';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function availabilityState(state: string): { label: string; tone: 'teal' | 'neutral' } {
  if (state === 'availability_configured') {
    return { label: 'Slots available', tone: 'teal' };
  }
  return { label: 'No slots for now', tone: 'neutral' };
}

export function toDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export type DateTile = {
  value: string;
  weekday: string;
  day: string;
  month: string;
  label: string;
};

export function buildDateTiles(count = 7, from = new Date()): DateTile[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + index);
    return {
      value: toDateValue(date),
      weekday: index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : date.toLocaleDateString('en-IN', { weekday: 'short' }),
      day: `${date.getDate()}`,
      month: date.toLocaleDateString('en-IN', { month: 'short' }),
      label: date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }),
    };
  });
}
