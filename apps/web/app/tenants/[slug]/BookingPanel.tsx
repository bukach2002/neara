'use client';

import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  UserRound,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { apiGet, apiPost, CustomerUser, Slot, TenantDetail } from '../../lib/api';
import { buildDateTiles, formatDuration, formatPrice, initials } from '../../components/neara/format';
import { Note } from '../../components/neara/primitives';

type SlotResponse = { items: Slot[] };
type BookingResponse = {
  bookingReference: string;
  displayTimeSnapshot: string;
  serviceNameSnapshot: string;
};

export function BookingPanel({ tenant }: { tenant: TenantDetail }) {
  const [serviceId, setServiceId] = useState(tenant.services[0]?.id ?? '');
  const [expertId, setExpertId] = useState('');
  const [date, setDate] = useState(() => buildDateTiles(1)[0].value);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [status, setStatus] = useState('');
  const [booking, setBooking] = useState<BookingResponse | null>(null);
  const [customer, setCustomer] = useState<CustomerUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const receiptRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const dates = useMemo(() => buildDateTiles(7), []);

  const selectedService = useMemo(
    () => tenant.services.find((service) => service.id === serviceId),
    [serviceId, tenant.services],
  );
  const eligibleExperts = selectedService?.expertServices.map((assignment) => assignment.expert) ?? tenant.experts;
  const returnTo = encodeURIComponent(pathname || `/tenants/${tenant.slug}`);
  const location = tenant.locations[0];
  const price = formatPrice(selectedService?.displayPriceAmount ?? null, selectedService?.displayPriceCurrency ?? null);

  useEffect(() => {
    if (booking) {
      receiptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [booking]);

  useEffect(() => {
    apiGet<{ user: CustomerUser }>('/api/public/auth/me')
      .then((result) => setCustomer(result.user))
      .catch(() => setCustomer(null))
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (!customer || !serviceId || !date) {
      setSlots([]);
      return;
    }

    let active = true;
    setSlotsLoading(true);
    setSelectedSlot(null);
    setStatus('');

    const params = new URLSearchParams({ serviceId, date });
    if (expertId) params.set('expertId', expertId);
    apiGet<SlotResponse>(`/api/public/tenants/${tenant.slug}/available-slots?${params}`)
      .then((result) => {
        if (active) setSlots(result.items);
      })
      .catch(() => {
        if (active) setStatus('Could not load slots for this selection. Please try another date.');
      })
      .finally(() => {
        if (active) setSlotsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [customer, date, expertId, serviceId, tenant.slug]);

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSlot) {
      setStatus('Choose a time before confirming.');
      return;
    }
    if (!customer) {
      setStatus('Sign in before confirming a booking.');
      return;
    }
    const form = new FormData(event.currentTarget);
    setStatus('Confirming your appointment…');
    try {
      const result = await apiPost<BookingResponse>(`/api/public/tenants/${tenant.slug}/bookings`, {
        serviceId,
        expertId: expertId || undefined,
        startsAt: selectedSlot.startsAt,
        customerName: customer.name,
        customerPhone: customer.mobileNumber || form.get('customerPhone'),
        customerEmail: customer.email || form.get('customerEmail') || undefined,
        customerNote: form.get('customerNote') || undefined,
        consentAccepted: form.get('consentAccepted') === 'on',
      });
      setBooking(result);
      setStatus('');
    } catch {
      setStatus('That slot may have just been taken. Pick another time and try again.');
    }
  }

  if (booking) {
    return (
      <section className="n-sheet" aria-label="Booking confirmed" ref={receiptRef}>
        <div className="n-receipt">
          <div className="n-receipt-band">
            <span className="n-pill n-pill-teal-solid">
              <CheckCircle2 aria-hidden="true" size={13} />
              Confirmed
            </span>
            <span className="n-meta n-tabular">{booking.bookingReference}</span>
          </div>
          <div className="n-receipt-body">
            <div>
              <p className="n-eyebrow">Appointment</p>
              <h2 className="n-receipt-title">{booking.serviceNameSnapshot}</h2>
              <p className="n-receipt-location">
                <MapPin aria-hidden="true" size={14} />
                {tenant.name}
                {location ? `, ${location.locality}` : ''}
              </p>
            </div>
            <div className="n-receipt-date">
              <CalendarCheck aria-hidden="true" size={18} />
              <div>
                <p className="n-option-title">{booking.displayTimeSnapshot}</p>
                <p className="n-option-sub">
                  {selectedSlot ? `With ${selectedSlot.expert.displayName}` : 'Practitioner assigned'}
                  {price ? ` · ${price} payable at venue` : ''}
                </p>
              </div>
            </div>
            <p className="n-meta">
              Keep your reference handy. We also email the details when an email address is on file.
            </p>
            <div className="n-confirm-actions">
              <a className="n-btn n-btn-secondary" href={`/booking-lookup?reference=${booking.bookingReference}`}>
                View booking
              </a>
              <a className="n-btn" href="/booking-lookup">
                Bookings
                <ArrowRight aria-hidden="true" size={16} />
              </a>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="n-sheet" id="booking-sheet" aria-label="Book an appointment">
        <div className="n-sheet-head">
          <p className="n-eyebrow">Instant confirmation</p>
          <h2 className="n-h2">Reserve a slot</h2>
          {customer ? (
            <p className="n-meta">Signed in as {customer.name}. No payment is taken online.</p>
          ) : (
            <p className="n-meta">Sign in to see live slots. Browsing is always free.</p>
          )}
        </div>

        <div className="n-step">
          <div className="n-step-head">
            <span className="n-step-num">1</span>
            <span className="n-title">Choose a service</span>
            {selectedService ? <span className="n-step-aside">{formatDuration(selectedService.durationMinutes)}</span> : null}
          </div>
          <div className="n-stack">
            {tenant.services.map((service) => {
              const servicePrice = formatPrice(service.displayPriceAmount, service.displayPriceCurrency);
              return (
                <button
                  type="button"
                  className="n-option"
                  key={service.id}
                  aria-pressed={service.id === serviceId}
                  onClick={() => {
                    setServiceId(service.id);
                    setExpertId('');
                    setStatus('');
                  }}
                >
                  <span className="n-radio" aria-hidden="true" />
                  <span className="n-option-body">
                    <span className="n-option-title">{service.name}</span>
                    <span className="n-option-sub">
                      {formatDuration(service.durationMinutes)}
                      {service.description ? ` · ${service.description}` : ''}
                    </span>
                  </span>
                  {servicePrice ? <span className="n-option-price">{servicePrice}</span> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="n-step">
          <div className="n-step-head">
            <span className="n-step-num">2</span>
            <span className="n-title">Practitioner</span>
            <span className="n-step-aside">Optional</span>
          </div>
          <div className="n-stack">
            <button type="button" className="n-option" aria-pressed={expertId === ''} onClick={() => setExpertId('')}>
              <span className="n-radio" aria-hidden="true" />
              <span className="n-option-body">
                <span className="n-option-title">Any available practitioner</span>
                <span className="n-option-sub">We assign the first qualified expert</span>
              </span>
            </button>
            {eligibleExperts.map((expert) => (
              <button
                type="button"
                className="n-option"
                key={expert.id}
                aria-pressed={expertId === expert.id}
                onClick={() => setExpertId(expert.id)}
              >
                <span className="n-radio" aria-hidden="true" />
                <span className="n-option-body">
                  <span className="n-option-title">{expert.displayName}</span>
                  {expert.shortBio ? <span className="n-option-sub">{expert.shortBio}</span> : null}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="n-step">
          <div className="n-step-head">
            <span className="n-step-num">3</span>
            <span className="n-title">Date and time</span>
          </div>
          <div className="n-date-strip" role="group" aria-label="Choose a date">
            {dates.map((tile) => (
              <button
                type="button"
                className="n-date"
                key={tile.value}
                aria-pressed={tile.value === date}
                aria-label={tile.label}
                onClick={() => setDate(tile.value)}
              >
                <span>{tile.weekday}</span>
                <strong>{tile.day}</strong>
                <small>{tile.month}</small>
              </button>
            ))}
          </div>

          {!authChecked ? (
            <div className="n-skeleton n-slot-loading" aria-hidden="true" />
          ) : !customer ? (
            <div className="n-gate">
              <p className="n-option-title">
                <LockKeyhole aria-hidden="true" size={14} /> Sign in to open the live diary
              </p>
              <p className="n-option-sub">
                Slots come straight from the studio calendar, so we ask you to sign in before holding one.
                Your account is free and takes less than a minute.
              </p>
              <div className="n-gate-actions">
                <a className="n-btn n-btn-sm" href={`/login?returnTo=${returnTo}`}>
                  Sign in
                </a>
                <a className="n-btn n-btn-secondary n-btn-sm" href={`/register?returnTo=${returnTo}`}>
                  Register
                </a>
              </div>
            </div>
          ) : slotsLoading ? (
            <p className="n-note">
              <LoaderCircle aria-hidden="true" size={16} />
              Checking the diary…
            </p>
          ) : slots.length > 0 ? (
            <>
              <div className="n-slot-grid" role="group" aria-label="Available times">
                {slots.map((slot) => {
                  const active = selectedSlot?.startsAt === slot.startsAt && selectedSlot.expert.id === slot.expert.id;
                  return (
                    <button
                      type="button"
                      className="n-slot"
                      key={`${slot.startsAt}-${slot.expert.id}`}
                      aria-pressed={active}
                      onClick={() => {
                        setSelectedSlot(slot);
                        setStatus('');
                      }}
                    >
                      {slot.displayTime}
                      <small>{slot.expert.displayName}</small>
                    </button>
                  );
                })}
              </div>
              {selectedSlot ? (
                <p className="n-hint">
                  <Clock aria-hidden="true" size={13} /> Held for you at {selectedSlot.displayTime} with{' '}
                  {selectedSlot.expert.displayName}. Confirm below to lock it in.
                </p>
              ) : (
                <p className="n-hint">Choose a time to continue.</p>
              )}
            </>
          ) : (
            <p className="n-note">
              No open slots for this selection. Try another date, practitioner, or the “Any practitioner”
              option.
            </p>
          )}
        </div>

        <form className="n-step" id="booking-form" onSubmit={submitBooking}>
          <div className="n-step-head">
            <span className="n-step-num">4</span>
            <span className="n-title">Your details</span>
          </div>
          {customer ? (
            <div className="n-identity">
              <span className="n-avatar-initials" aria-hidden="true">
                {initials(customer.name)}
              </span>
              <div>
                <strong>{customer.name}</strong>
                <small>{customer.mobileNumber ?? customer.email ?? 'Add a phone number to be contacted'}</small>
              </div>
            </div>
          ) : (
            <p className="n-note">
              <UserRound aria-hidden="true" size={16} />
              Sign in above and we will fill these in from your account.
            </p>
          )}

          {customer ? (
            <>
              {!customer.mobileNumber ? (
                <label className="n-field">
                  <span className="n-field-label">Mobile number</span>
                  <input
                    className="n-input"
                    name="customerPhone"
                    placeholder="+919876543210"
                    required
                    pattern="^\+[1-9]\d{7,14}$"
                    autoComplete="tel"
                  />
                </label>
              ) : null}
              <label className="n-field">
                <span className="n-field-label">Note for the studio</span>
                <textarea
                  className="n-textarea"
                  name="customerNote"
                  rows={3}
                  maxLength={500}
                  placeholder="Allergies, accessibility needs, or a preferred stylist"
                />
              </label>
              <label className="n-check">
                <input name="consentAccepted" type="checkbox" required />
                <span>
                  I agree to Neara sharing these details with {tenant.name} and contacting me about this
                  appointment.
                </span>
              </label>
              <button type="submit" className="n-btn n-btn-block n-sheet-submit">
                Confirm booking
                {price ? <span className="n-tabular">· {price}</span> : null}
              </button>
            </>
          ) : null}
        </form>

        {status ? (
          <Note tone={status.startsWith('Could') || status.startsWith('That') ? 'error' : 'neutral'}>{status}</Note>
        ) : null}
      </section>

      <div className="n-sticky">
        <div className="n-sticky-inner">
          <div className="n-sticky-total">
            <span className="n-meta">{price ? 'Payable at venue' : 'Select a service'}</span>
            <span className="n-price-lg n-tabular">{price ?? '—'}</span>
          </div>
          {customer ? (
            <button type="submit" form="booking-form" className="n-btn">
              Confirm booking
            </button>
          ) : (
            <a className="n-btn" href={`/login?returnTo=${returnTo}`}>
              Sign in to book
            </a>
          )}
        </div>
      </div>
    </>
  );
}
