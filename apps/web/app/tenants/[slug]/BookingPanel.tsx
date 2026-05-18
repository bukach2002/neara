'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { apiGet, apiPost, CustomerUser, ServiceDetail, Slot, TenantDetail } from '../../lib/api';
import { Notice } from '../../components/ui';

type SlotResponse = { items: Slot[] };
type BookingResponse = { bookingReference: string; displayTimeSnapshot: string; serviceNameSnapshot: string };

export function BookingPanel({ tenant }: { tenant: TenantDetail }) {
  const [serviceId, setServiceId] = useState(tenant.services[0]?.id ?? '');
  const [expertId, setExpertId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [status, setStatus] = useState('');
  const [booking, setBooking] = useState<BookingResponse | null>(null);
  const [customer, setCustomer] = useState<CustomerUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const pathname = usePathname();

  const selectedService = useMemo(() => tenant.services.find((service) => service.id === serviceId), [serviceId, tenant.services]);
  const eligibleExperts = selectedService?.expertServices.map((assignment) => assignment.expert) ?? tenant.experts;
  const returnTo = encodeURIComponent(pathname || `/tenants/${tenant.slug}`);

  useEffect(() => {
    apiGet<{ user: CustomerUser }>('/api/public/auth/me')
      .then((result) => setCustomer(result.user))
      .catch(() => setCustomer(null))
      .finally(() => setAuthChecked(true));
  }, []);

  async function loadSlots() {
    if (!customer) {
      setStatus('Please login or register before viewing available slots.');
      return;
    }
    setStatus('Loading slots...');
    setSelectedSlot(null);
    setBooking(null);
    const params = new URLSearchParams({ serviceId, date });
    if (expertId) params.set('expertId', expertId);
    try {
      const result = await apiGet<SlotResponse>(`/api/public/tenants/${tenant.slug}/available-slots?${params}`);
      setSlots(result.items);
      setStatus(result.items.length ? '' : 'No slots currently available.');
    } catch {
      setStatus('Could not load slots.');
    }
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSlot) {
      setStatus('Choose a slot first.');
      return;
    }
    if (!customer) {
      setStatus('Please login or register before confirming a booking.');
      return;
    }
    const form = new FormData(event.currentTarget);
    setStatus('Creating booking...');
    try {
      const result = await apiPost<BookingResponse>(`/api/public/tenants/${tenant.slug}/bookings`, {
        serviceId,
        expertId: expertId || undefined,
        startsAt: selectedSlot.startsAt,
        customerName: form.get('customerName'),
        customerPhone: customer.mobileNumber || form.get('customerPhone'),
        customerEmail: customer.email || form.get('customerEmail') || undefined,
        customerNote: form.get('customerNote') || undefined,
        consentAccepted: form.get('consentAccepted') === 'on',
      });
      setBooking(result);
      setStatus('');
    } catch {
      setStatus('Booking could not be created. The slot may no longer be available.');
    }
  }

  return (
    <section className="booking-surface" aria-label="Book appointment">
      <div className="booking-title">
        <p className="eyebrow">Instant booking</p>
        <h2>Reserve a slot</h2>
        {authChecked && !customer && (
          <div className="auth-gate">
            <p>Login or register to view free slots and book appointments.</p>
            <div>
              <a className="button-link" href={`/login?returnTo=${returnTo}`}>Login</a>
              <a className="button-link secondary" href={`/register?returnTo=${returnTo}`}>Register</a>
            </div>
          </div>
        )}
        {customer && <p className="muted">Signed in as {customer.name}</p>}
      </div>
      <div className="booking-controls">
        <div className="booking-step">
          <span className="step-number">1</span>
          <label>
            <span>Service</span>
            <select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
              {tenant.services.map((service: ServiceDetail) => (
                <option value={service.id} key={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="booking-step">
          <span className="step-number">2</span>
          <div className="booking-step-grid">
            <label>
              <span>Expert</span>
              <select value={expertId} onChange={(event) => setExpertId(event.target.value)}>
                <option value="">Any expert</option>
                {eligibleExperts.map((expert) => (
                  <option value={expert.id} key={expert.id}>
                    {expert.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Date</span>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
          </div>
        </div>
        <button type="button" onClick={loadSlots}>
          Find slots
        </button>
      </div>

      <div className="booking-step-label"><span className="step-number">3</span><span>Choose a time</span></div>
      <div className="slot-grid">
        {slots.map((slot) => (
          <button className={selectedSlot?.startsAt === slot.startsAt && selectedSlot.expert.id === slot.expert.id ? 'slot selected' : 'slot'} type="button" onClick={() => setSelectedSlot(slot)} key={`${slot.startsAt}-${slot.expert.id}`}>
            <span>{slot.displayTime}</span>
            <small>{slot.expert.displayName}</small>
          </button>
        ))}
      </div>

      <div className="booking-step-label"><span className="step-number">4</span><span>Your details</span></div>
      <form className="booking-form" onSubmit={submitBooking}>
        <input name="customerName" placeholder="Full name" required minLength={2} defaultValue={customer?.name ?? ''} />
        <input name="customerPhone" placeholder="+919876543210" required pattern="^\+[1-9]\d{7,14}$" defaultValue={customer?.mobileNumber ?? ''} readOnly={Boolean(customer?.mobileNumber)} />
        <input name="customerEmail" placeholder="Email optional" type="email" defaultValue={customer?.email ?? ''} readOnly={Boolean(customer?.email)} />
        <textarea name="customerNote" placeholder="Note optional" maxLength={500} />
        <label className="check-row">
          <input name="consentAccepted" type="checkbox" required />
          <span>I consent to storing my booking details and being contacted about this appointment.</span>
        </label>
        <button type="submit">Confirm booking</button>
      </form>

      {status && <Notice>{status}</Notice>}
      {booking && (
        <div className="confirmation">
          <p className="eyebrow">Booking confirmed</p>
          <h2>{booking.bookingReference}</h2>
          <p>{booking.serviceNameSnapshot}</p>
          <p>{booking.displayTimeSnapshot}</p>
        </div>
      )}
    </section>
  );
}
