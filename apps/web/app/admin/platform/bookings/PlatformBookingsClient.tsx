'use client';

import { FormEvent, useEffect, useState } from 'react';
import { adminGet, adminSend, TenantRow } from '../../lib/adminApi';

type Booking = {
  id: string;
  bookingReference: string;
  status: string;
  startsAt: string;
  endsAt?: string;
  displayTimeSnapshot?: string;
  locationAddressSnapshot?: string;
  customerNote?: string | null;
  customerNameSnapshot: string;
  customerPhoneSnapshot: string | null;
  customerEmailSnapshot: string | null;
  tenant: { id: string; name: string; slug: string };
  service: { id: string; name: string };
  expert: { id: string; displayName: string };
  location: { id: string; name: string; locality: string };
};

type BookingList = { items: Booking[]; total: number; take: number; skip: number };
const pageSize = 25;

export function PlatformBookingsClient() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [bookings, setBookings] = useState<BookingList>({ items: [], total: 0, take: pageSize, skip: 0 });
  const [query, setQuery] = useState(new URLSearchParams({ take: String(pageSize) }));
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('Loading bookings...');

  async function loadBookings(params = query) {
    setLoading(true);
    setStatus('');
    try {
      const result = await adminGet<BookingList>(`/api/admin/platform/bookings?${params.toString()}`);
      setBookings(result);
      setQuery(params);
      setSelectedBooking(null);
    } catch {
      setStatus('Could not load platform bookings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initialQuery = new URLSearchParams({ take: String(pageSize), skip: '0' });
    Promise.all([adminGet<TenantRow[]>('/api/admin/platform/tenants'), loadBookings(initialQuery)])
      .then(([tenantRows]) => {
        setTenants(tenantRows);
      })
      .catch(() => setStatus('Could not load platform bookings.'));
  }, []);

  async function filterBookings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams({ take: String(pageSize), skip: '0' });
    for (const field of ['tenantId', 'status', 'search', 'from', 'to']) {
      const value = form.get(field);
      if (value) params.set(field, String(value));
    }
    await loadBookings(params);
  }

  async function cancelBooking(bookingId: string) {
    const reason = window.prompt('Reason for platform cancellation');
    if (reason === null) return;
    await adminSend(`/api/admin/platform/bookings/${bookingId}/cancel`, 'POST', { reason });
    await loadBookings(query);
  }

  async function viewBooking(bookingId: string) {
    setStatus('Loading booking detail...');
    try {
      const detail = await adminGet<Booking>(`/api/admin/platform/bookings/${bookingId}`);
      setSelectedBooking(detail);
      setStatus('');
    } catch {
      setStatus('Could not load booking detail.');
    }
  }

  async function changePage(direction: -1 | 1) {
    const nextSkip = Math.max(0, bookings.skip + direction * bookings.take);
    const params = new URLSearchParams(query);
    params.set('take', String(pageSize));
    params.set('skip', String(nextSkip));
    await loadBookings(params);
  }

  function displayDate(value: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>Booking lookup</h1>
          <p>Find bookings by tenant, appointment date, reference, or customer details.</p>
        </div>
      </div>
      {status && <p className="notice">{status}</p>}
      <form className="admin-form-row platform-booking-filter" onSubmit={filterBookings}>
        <input name="search" placeholder="Reference, customer, tenant, service" />
        <select name="tenantId" defaultValue="">
          <option value="">All tenants</option>
          {tenants.map((tenant) => <option value={tenant.id} key={tenant.id}>{tenant.name}</option>)}
        </select>
        <select name="status" defaultValue="">
          <option value="">Any status</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
          <option value="no_show">No-show</option>
        </select>
        <input name="from" type="date" aria-label="From date" />
        <input name="to" type="date" aria-label="To date" />
        <button type="submit">Lookup</button>
      </form>
      <p className="notice">{loading ? 'Loading bookings...' : `${bookings.total} matching bookings`}</p>
      {selectedBooking && (
        <section className="detail-panel">
          <div className="section-title-row">
            <h2>{selectedBooking.bookingReference}</h2>
            <button type="button" className="text-action" onClick={() => setSelectedBooking(null)}>Close</button>
          </div>
          <dl className="detail-grid">
            <div><dt>Tenant</dt><dd>{selectedBooking.tenant.name}</dd></div>
            <div><dt>Customer</dt><dd>{selectedBooking.customerNameSnapshot}</dd></div>
            <div><dt>Phone</dt><dd>{selectedBooking.customerPhoneSnapshot ?? 'Not stored'}</dd></div>
            <div><dt>Email</dt><dd>{selectedBooking.customerEmailSnapshot ?? 'Not provided'}</dd></div>
            <div><dt>Service</dt><dd>{selectedBooking.service.name}</dd></div>
            <div><dt>Expert</dt><dd>{selectedBooking.expert.displayName}</dd></div>
            <div><dt>Time</dt><dd>{selectedBooking.displayTimeSnapshot ?? displayDate(selectedBooking.startsAt)}</dd></div>
            <div><dt>Location</dt><dd>{selectedBooking.locationAddressSnapshot ?? `${selectedBooking.location.name}, ${selectedBooking.location.locality}`}</dd></div>
            <div><dt>Status</dt><dd><span className={`badge ${selectedBooking.status}`}>{selectedBooking.status}</span></dd></div>
          </dl>
        </section>
      )}
      <div className="admin-table">
        <div className="admin-row platform-booking-row admin-row-head">
          <span>Booking</span>
          <span>Tenant</span>
          <span>Customer</span>
          <span>When</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        {bookings.items.map((booking) => (
          <div className="admin-row platform-booking-row" key={booking.id}>
            <span>{booking.bookingReference}<small>{booking.service.name} with {booking.expert.displayName}</small></span>
            <span>{booking.tenant.name}<small>{booking.tenant.slug}</small></span>
            <span>{booking.customerNameSnapshot}<small>{booking.customerPhoneSnapshot ?? booking.customerEmailSnapshot ?? 'No contact'}</small></span>
            <span>{displayDate(booking.startsAt)}<small>{booking.location.name}, {booking.location.locality}</small></span>
            <span className={`badge ${booking.status}`}>{booking.status}</span>
            <span className="admin-actions">
              <button type="button" onClick={() => viewBooking(booking.id)}>View</button>
              {booking.status === 'confirmed' && (
                <button type="button" onClick={() => cancelBooking(booking.id)}>Cancel</button>
              )}
            </span>
          </div>
        ))}
        {bookings.items.length === 0 && <div className="admin-row platform-booking-row"><span>No bookings found</span></div>}
      </div>
      <div className="pagination-row">
        <button type="button" onClick={() => changePage(-1)} disabled={bookings.skip === 0 || loading}>Previous</button>
        <span>{bookings.total === 0 ? '0-0' : `${bookings.skip + 1}-${Math.min(bookings.skip + bookings.items.length, bookings.total)}`} of {bookings.total}</span>
        <button type="button" onClick={() => changePage(1)} disabled={bookings.skip + bookings.take >= bookings.total || loading}>Next</button>
      </div>
    </>
  );
}
