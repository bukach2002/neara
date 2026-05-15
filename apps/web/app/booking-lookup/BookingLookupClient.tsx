'use client';

import { FormEvent, useState } from 'react';
import { Search } from 'lucide-react';
import { apiGet } from '../lib/api';

type BookingLookup = {
  bookingReference: string;
  status: string;
  displayTimeSnapshot: string;
  tenantNameSnapshot: string;
  locationNameSnapshot: string;
  serviceNameSnapshot: string;
  expertDisplayNameSnapshot: string;
};

export function BookingLookupClient() {
  const [booking, setBooking] = useState<BookingLookup | null>(null);
  const [status, setStatus] = useState('');

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBooking(null);
    setStatus('Looking up booking...');
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams({
      reference: String(form.get('reference') ?? ''),
      phone: String(form.get('phone') ?? ''),
    });
    try {
      const result = await apiGet<BookingLookup>(`/api/public/bookings/lookup?${params}`);
      setBooking(result);
      setStatus('');
    } catch {
      setStatus('No matching booking found.');
    }
  }

  return (
    <>
      <form className="lookup-form" onSubmit={lookup}>
        <label>
          <span>Booking reference</span>
          <input name="reference" placeholder="NEAR-7A2K" required />
        </label>
        <label>
          <span>Phone number</span>
          <input name="phone" placeholder="+919876543210" required />
        </label>
        <button type="submit">
          <Search size={18} aria-hidden="true" />
          Find booking
        </button>
      </form>

      {status && <p className="notice">{status}</p>}
      {booking && (
        <section className="confirmation">
          <p className="eyebrow">{booking.status}</p>
          <h2>{booking.bookingReference}</h2>
          <p>{booking.tenantNameSnapshot}</p>
          <p>{booking.serviceNameSnapshot} with {booking.expertDisplayNameSnapshot}</p>
          <p>{booking.displayTimeSnapshot}</p>
          <p className="muted">{booking.locationNameSnapshot}</p>
        </section>
      )}
    </>
  );
}
