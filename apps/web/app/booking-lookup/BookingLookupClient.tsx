'use client';

import {
  CalendarCheck,
  Check,
  ClipboardCopy,
  MapPin,
  Phone,
  RotateCcw,
  Search,
  Ticket,
  UserRound,
} from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { apiGet, CustomerUser } from '../lib/api';
import { Note, Pill } from '../components/neara/primitives';

type BookingLookup = {
  bookingReference: string;
  status: string;
  displayTimeSnapshot: string;
  tenantNameSnapshot: string;
  locationNameSnapshot: string;
  serviceNameSnapshot: string;
  expertDisplayNameSnapshot: string;
};

export function BookingLookupClient({ initialReference = '' }: { initialReference?: string }) {
  const [booking, setBooking] = useState<BookingLookup | null>(null);
  const [reference, setReference] = useState(initialReference);
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [customer, setCustomer] = useState<CustomerUser | null>(null);

  useEffect(() => {
    apiGet<{ user: CustomerUser }>('/api/public/auth/me')
      .then((result) => {
        setCustomer(result.user);
        if (result.user.mobileNumber) setPhone(result.user.mobileNumber);
      })
      .catch(() => setCustomer(null));
  }, []);

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setBooking(null);
    setStatus('');
    const params = new URLSearchParams({ reference: reference.trim(), phone: phone.trim() });
    try {
      const result = await apiGet<BookingLookup>(`/api/public/bookings/lookup?${params}`);
      setBooking(result);
    } catch {
      setStatus('No booking matched that reference and phone number. Check both and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function copyReference() {
    if (!booking) return;
    try {
      await navigator.clipboard.writeText(booking.bookingReference);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const confirmed = booking?.status?.toLowerCase() === 'confirmed';

  return (
    <main className="n-main">
      <div className="n-hero">
        <span className="n-hero-badge">
          <Ticket aria-hidden="true" size={14} />
          <span>Concierge desk</span>
        </span>
        <h1 className="n-display">Your bookings</h1>
        <p className="n-body-lg">
          Look up a confirmed appointment with the reference from your confirmation and the phone number used
          to book.
        </p>
      </div>

      {booking ? (
        <section className="n-receipt n-mt-lg" aria-label="Booking details">
          <div className="n-receipt-band">
            <Pill tone={confirmed ? 'teal' : 'neutral'} dot>
              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
            </Pill>
            <button type="button" className="n-link n-link-quiet" onClick={copyReference}>
              {copied ? <Check aria-hidden="true" size={13} /> : <ClipboardCopy aria-hidden="true" size={13} />}
              {copied ? 'Copied' : booking.bookingReference}
            </button>
          </div>
          <div className="n-receipt-body">
            <div>
              <p className="n-eyebrow">Appointment</p>
              <h2 className="n-receipt-title">{booking.serviceNameSnapshot}</h2>
              <p className="n-receipt-location">
                <MapPin aria-hidden="true" size={14} />
                {booking.tenantNameSnapshot}
                {booking.locationNameSnapshot ? `, ${booking.locationNameSnapshot}` : ''}
              </p>
            </div>

            <div className="n-receipt-date">
              <CalendarCheck aria-hidden="true" size={18} />
              <div>
                <p className="n-option-title">{booking.displayTimeSnapshot}</p>
                <p className="n-option-sub">Please arrive a few minutes early for check-in.</p>
              </div>
            </div>

            <dl className="n-receipt-rows">
              <div className="n-receipt-row">
                <dt>Reference</dt>
                <dd className="n-tabular">{booking.bookingReference}</dd>
              </div>
              <div className="n-receipt-row">
                <dt>Practitioner</dt>
                <dd>{booking.expertDisplayNameSnapshot}</dd>
              </div>
              <div className="n-receipt-row">
                <dt>Studio</dt>
                <dd>{booking.tenantNameSnapshot}</dd>
              </div>
              <div className="n-receipt-row">
                <dt>Where</dt>
                <dd>{booking.locationNameSnapshot || 'See studio details'}</dd>
              </div>
            </dl>

            <p className="n-receipt-assurance">
              <Phone aria-hidden="true" size={16} />
              <span>
                To reschedule or cancel, contact the studio directly and quote this reference. Settlement
                happens at the venue.
              </span>
            </p>

            <div className="n-confirm-actions">
              <button type="button" className="n-btn n-btn-secondary" onClick={() => setBooking(null)}>
                <RotateCcw aria-hidden="true" size={16} />
                Look up another
              </button>
              <a className="n-btn" href="/">
                Discover studios
              </a>
            </div>
          </div>
        </section>
      ) : (
        <form className="n-card n-card-pad n-mt-lg" onSubmit={lookup}>
          <div className="n-sheet-head">
            <p className="n-eyebrow">Booking lookup</p>
            <h2 className="n-h2">Find your appointment</h2>
            <p className="n-meta">
              {customer
                ? `Signed in as ${customer.name}. Use the number on this account, or any number the studio has on file.`
                : 'Both fields must match the booking exactly.'}
            </p>
          </div>

          <div className="n-stack n-mt">
            <label className="n-field">
              <span className="n-field-label">Booking reference</span>
              <span className="n-input-wrap">
                <Ticket className="n-input-icon" aria-hidden="true" size={18} />
                <input
                  className="n-input"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="NEAR-7A2K"
                  autoComplete="off"
                  required
                />
              </span>
            </label>

            <label className="n-field">
              <span className="n-field-label">Phone number</span>
              <span className="n-input-wrap">
                <Phone className="n-input-icon" aria-hidden="true" size={18} />
                <input
                  className="n-input"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+919876543210"
                  pattern="^\+[1-9]\d{7,14}$"
                  autoComplete="tel"
                  required
                />
              </span>
            </label>

            <button type="submit" className="n-btn n-btn-block" disabled={busy}>
              <Search aria-hidden="true" size={18} />
              {busy ? 'Looking up…' : 'Find booking'}
            </button>
          </div>

          {status ? (
            <div className="n-mt">
              <Note tone="error">{status}</Note>
            </div>
          ) : null}

          <p className="n-receipt-assurance n-mt">
            <UserRound aria-hidden="true" size={16} />
            <span>
              Booking details are private to the reference and phone number on file. You can also view them
              right after booking.
            </span>
          </p>
        </form>
      )}
    </main>
  );
}
