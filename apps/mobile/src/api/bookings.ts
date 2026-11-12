import { apiRequest, buildQuery } from '@/lib/http';
import type { BookingRecord, CreateBookingInput } from '@/types';

export function createBooking(slug: string, input: CreateBookingInput) {
  return apiRequest<BookingRecord>(`/public/tenants/${encodeURIComponent(slug)}/bookings`, {
    method: 'POST',
    body: input,
  });
}

export function lookupBooking(input: { reference: string; phone: string }) {
  return apiRequest<BookingRecord>(
    `/public/bookings/lookup${buildQuery({
      reference: input.reference.trim().toUpperCase(),
      phone: input.phone.trim(),
    })}`,
    { notifyUnauthorized: false },
  );
}
