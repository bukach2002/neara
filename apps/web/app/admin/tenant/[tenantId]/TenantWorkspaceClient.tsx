'use client';

import { FormEvent, useEffect, useState } from 'react';
import { adminGet, adminSend, adminUpload } from '../../lib/adminApi';

type Dashboard = { bookingsToday: number; upcomingBookings: number; confirmedBookings: number; cancelledBookings: number };
type Profile = { id: string; name: string; description: string | null; publicEmail: string | null; publicPhone: string | null };
type Service = {
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
type Expert = { id: string; displayName: string; slug: string; shortBio: string | null; isActive: boolean; photoUrl?: string | null };
type Location = { id: string; name: string; addressLine: string; locality: string; city: string; isActive: boolean };
type AvailabilityRule = { id: string; dayOfWeek: number; startLocalTime: string; endLocalTime: string };
type AvailabilityException = {
  id: string;
  type: 'block' | 'override';
  startsOn: string;
  endsOn: string;
  startLocalTime: string | null;
  endLocalTime: string | null;
  reason: string | null;
};
type Booking = {
  id: string;
  bookingReference: string;
  status: string;
  startsAt: string;
  endsAt: string;
  displayTimeSnapshot?: string;
  locationAddressSnapshot?: string;
  customerNote?: string | null;
  customerNameSnapshot: string;
  customerPhoneSnapshot: string | null;
  customerEmailSnapshot: string | null;
  service: { id: string; name: string };
  expert: { id: string; displayName: string };
  location: { id: string; name: string; locality: string };
};
type BookingList = { items: Booking[]; total: number; take: number; skip: number };
type GeocodeResult = {
  formattedAddress: string;
  latitude: number;
  longitude: number;
  locality?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
};

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const bookingPageSize = 25;

export function TenantWorkspaceClient({ tenantId }: { tenantId: string }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [experts, setExperts] = useState<Expert[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [availabilityExpertId, setAvailabilityExpertId] = useState('');
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([]);
  const [bookings, setBookings] = useState<BookingList>({ items: [], total: 0, take: bookingPageSize, skip: 0 });
  const [bookingQuery, setBookingQuery] = useState(new URLSearchParams({ take: String(bookingPageSize), skip: '0' }));
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [status, setStatus] = useState('');

  async function load() {
    const [dash, prof, loc, svc, exp] = await Promise.all([
      adminGet<Dashboard>(`/api/admin/tenant/${tenantId}/dashboard`),
      adminGet<Profile>(`/api/admin/tenant/${tenantId}/profile`),
      adminGet<Location[]>(`/api/admin/tenant/${tenantId}/locations`),
      adminGet<Service[]>(`/api/admin/tenant/${tenantId}/services`),
      adminGet<Expert[]>(`/api/admin/tenant/${tenantId}/experts`),
    ]);
    setDashboard(dash);
    setProfile(prof);
    setLocations(loc);
    setServices(svc);
    setExperts(exp);
    setAvailabilityExpertId((current) => current || exp[0]?.id || '');
    await loadBookings();
  }

  async function loadAvailability(expertId = availabilityExpertId) {
    if (!expertId) {
      setRules([]);
      setExceptions([]);
      return;
    }
    const [ruleRows, exceptionRows] = await Promise.all([
      adminGet<AvailabilityRule[]>(`/api/admin/tenant/${tenantId}/experts/${expertId}/availability-rules`),
      adminGet<AvailabilityException[]>(`/api/admin/tenant/${tenantId}/experts/${expertId}/availability-exceptions`),
    ]);
    setRules(ruleRows);
    setExceptions(exceptionRows);
  }

  async function loadBookings(params = bookingQuery) {
    setBookingLoading(true);
    try {
      const result = await adminGet<BookingList>(`/api/admin/tenant/${tenantId}/bookings?${params.toString()}`);
      setBookings(result);
      setBookingQuery(params);
      setSelectedBooking(null);
    } catch {
      setStatus('Could not load bookings.');
    } finally {
      setBookingLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => setStatus('Could not load tenant workspace.'));
  }, [tenantId]);

  useEffect(() => {
    loadAvailability().catch(() => setStatus('Could not load availability.'));
  }, [availabilityExpertId, tenantId]);

  async function addService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await adminSend(`/api/admin/tenant/${tenantId}/services`, 'POST', {
      name: form.get('name'),
      slug: form.get('slug'),
      durationMinutes: Number(form.get('durationMinutes')),
      displayPriceAmount: form.get('displayPriceAmount') ? Number(form.get('displayPriceAmount')) : undefined,
    });
    event.currentTarget.reset();
    await load();
  }

  async function addExpert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await adminSend(`/api/admin/tenant/${tenantId}/experts`, 'POST', {
      displayName: form.get('displayName'),
      slug: form.get('slug'),
      shortBio: form.get('shortBio') || undefined,
    });
    event.currentTarget.reset();
    await load();
  }

  async function updateService(event: FormEvent<HTMLFormElement>, serviceId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await adminSend(`/api/admin/tenant/${tenantId}/services/${serviceId}`, 'PATCH', {
      name: form.get('name'),
      durationMinutes: Number(form.get('durationMinutes')),
      displayPriceAmount: form.get('displayPriceAmount') ? Number(form.get('displayPriceAmount')) : undefined,
      isActive: form.get('isActive') === 'on',
      isPublic: form.get('isPublic') === 'on',
    });
    await load();
  }

  async function updateExpert(event: FormEvent<HTMLFormElement>, expertId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await adminSend(`/api/admin/tenant/${tenantId}/experts/${expertId}`, 'PATCH', {
      displayName: form.get('displayName'),
      shortBio: form.get('shortBio') || undefined,
      isActive: form.get('isActive') === 'on',
    });
    await load();
  }

  async function saveLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await adminSend(`/api/admin/tenant/${tenantId}/locations/primary`, 'POST', {
      name: form.get('name'),
      addressLine: form.get('addressLine'),
      locality: form.get('locality'),
      city: form.get('city'),
      state: form.get('state') || undefined,
      postalCode: form.get('postalCode') || undefined,
      latitude: Number(form.get('latitude')),
      longitude: Number(form.get('longitude')),
    });
    await load();
  }

  async function geocodeLocation(form: HTMLFormElement) {
    const data = new FormData(form);
    const address = [data.get('addressLine'), data.get('locality'), data.get('city'), data.get('state'), data.get('postalCode')]
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
      .join(', ');
    if (!address) {
      setStatus('Enter an address before geocoding.');
      return;
    }

    setStatus('Looking up coordinates...');
    try {
      const result = await adminGet<GeocodeResult>(`/api/admin/tenant/${tenantId}/geocode?address=${encodeURIComponent(address)}`);
      const setInput = (name: string, value?: string | number) => {
        const input = form.elements.namedItem(name) as HTMLInputElement | null;
        if (input && value !== undefined) input.value = String(value);
      };
      setInput('latitude', result.latitude);
      setInput('longitude', result.longitude);
      setInput('locality', result.locality);
      setInput('city', result.city);
      setInput('state', result.state);
      setInput('postalCode', result.postalCode);
      setStatus(`Coordinates found for ${result.formattedAddress}`);
    } catch {
      setStatus('Could not geocode this address.');
    }
  }

  async function uploadLogo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await adminUpload(`/api/admin/tenant/${tenantId}/logo`, form);
    event.currentTarget.reset();
    await load();
  }

  async function uploadExpertPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const expertId = String(form.get('expertId'));
    form.delete('expertId');
    await adminUpload(`/api/admin/tenant/${tenantId}/experts/${expertId}/photo`, form);
    event.currentTarget.reset();
    await load();
  }

  async function assignServices(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const expertId = String(form.get('expertId'));
    const serviceIds = form.getAll('serviceIds').map(String);
    await adminSend(`/api/admin/tenant/${tenantId}/experts/${expertId}/services`, 'POST', { serviceIds });
    await load();
  }

  async function addAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const expertId = String(form.get('expertId'));
    await adminSend(`/api/admin/tenant/${tenantId}/experts/${expertId}/availability-rules`, 'POST', {
      dayOfWeek: Number(form.get('dayOfWeek')),
      startLocalTime: form.get('startLocalTime'),
      endLocalTime: form.get('endLocalTime'),
    });
    event.currentTarget.reset();
    setAvailabilityExpertId(expertId);
    await loadAvailability(expertId);
  }

  async function archiveAvailabilityRule(ruleId: string) {
    await adminSend(`/api/admin/tenant/${tenantId}/experts/${availabilityExpertId}/availability-rules/${ruleId}`, 'DELETE');
    await loadAvailability();
  }

  async function addException(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const expertId = String(form.get('expertId'));
    const startLocalTime = form.get('startLocalTime');
    const endLocalTime = form.get('endLocalTime');
    await adminSend(`/api/admin/tenant/${tenantId}/experts/${expertId}/availability-exceptions`, 'POST', {
      type: form.get('type'),
      startsOn: form.get('startsOn'),
      endsOn: form.get('endsOn'),
      startLocalTime: startLocalTime ? String(startLocalTime) : undefined,
      endLocalTime: endLocalTime ? String(endLocalTime) : undefined,
      reason: form.get('reason') || undefined,
    });
    event.currentTarget.reset();
    setAvailabilityExpertId(expertId);
    await loadAvailability(expertId);
  }

  async function deleteException(exceptionId: string) {
    await adminSend(`/api/admin/tenant/${tenantId}/experts/${availabilityExpertId}/availability-exceptions/${exceptionId}`, 'DELETE');
    await loadAvailability();
  }

  async function filterBookings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams({ take: String(bookingPageSize), skip: '0' });
    for (const field of ['status', 'serviceId', 'expertId', 'search']) {
      const value = form.get(field);
      if (value) params.set(field, String(value));
    }
    await loadBookings(params);
  }

  async function transitionBooking(bookingId: string, action: 'cancel' | 'complete' | 'no-show') {
    const reason = window.prompt('Optional note for the audit log') ?? undefined;
    await adminSend(`/api/admin/tenant/${tenantId}/bookings/${bookingId}/${action}`, 'POST', { reason });
    await Promise.all([loadBookings(bookingQuery), load()]);
  }

  async function viewBooking(bookingId: string) {
    setStatus('Loading booking detail...');
    try {
      const detail = await adminGet<Booking>(`/api/admin/tenant/${tenantId}/bookings/${bookingId}`);
      setSelectedBooking(detail);
      setStatus('');
    } catch {
      setStatus('Could not load booking detail.');
    }
  }

  async function changeBookingPage(direction: -1 | 1) {
    const nextSkip = Math.max(0, bookings.skip + direction * bookings.take);
    const params = new URLSearchParams(bookingQuery);
    params.set('take', String(bookingPageSize));
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
          <h1>{profile?.name ?? 'Tenant workspace'}</h1>
          <p>{profile?.publicEmail ?? 'Configure services, experts, and availability.'}</p>
        </div>
      </div>
      {status && <p className="notice">{status}</p>}
      {dashboard && (
        <section className="metric-grid">
          <div><strong>{dashboard.bookingsToday}</strong><span>Today</span></div>
          <div><strong>{dashboard.upcomingBookings}</strong><span>Upcoming</span></div>
          <div><strong>{dashboard.confirmedBookings}</strong><span>Confirmed</span></div>
          <div><strong>{dashboard.cancelledBookings}</strong><span>Cancelled</span></div>
        </section>
      )}
      <section className="admin-grid-two">
        <form className="admin-form" onSubmit={saveLocation}>
          <h2>Primary location</h2>
          <input name="name" placeholder="Main Studio" defaultValue={locations[0]?.name ?? ''} required />
          <input name="addressLine" placeholder="Address" defaultValue={locations[0]?.addressLine ?? ''} required />
          <input name="locality" placeholder="Locality" defaultValue={locations[0]?.locality ?? ''} required />
          <input name="city" placeholder="City" defaultValue={locations[0]?.city ?? ''} required />
          <input name="state" placeholder="State optional" />
          <input name="postalCode" placeholder="Postal code optional" />
          <input name="latitude" placeholder="Latitude" type="number" step="0.000001" required />
          <input name="longitude" placeholder="Longitude" type="number" step="0.000001" required />
          <button type="button" className="secondary-button" onClick={(event) => geocodeLocation(event.currentTarget.form!)}>
            Find coordinates
          </button>
          <button type="submit">Save location</button>
        </form>
        <form className="admin-form" onSubmit={uploadLogo}>
          <h2>Tenant logo</h2>
          <input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required />
          <button type="submit">Upload logo</button>
        </form>
      </section>
      <section className="admin-grid-two">
        <form className="admin-form" onSubmit={addService}>
          <h2>Add service</h2>
          <input name="name" placeholder="Service name" required />
          <input name="slug" placeholder="service-slug" required />
          <input name="durationMinutes" placeholder="45" type="number" required />
          <input name="displayPriceAmount" placeholder="Price optional" type="number" />
          <button type="submit">Create service</button>
        </form>
        <form className="admin-form" onSubmit={addExpert}>
          <h2>Add expert</h2>
          <input name="displayName" placeholder="Expert name" required />
          <input name="slug" placeholder="expert-slug" required />
          <input name="shortBio" placeholder="Short bio optional" />
          <button type="submit">Create expert</button>
        </form>
      </section>
      <section className="admin-grid-two">
        <form className="admin-form" onSubmit={assignServices}>
          <h2>Assign expert services</h2>
          <select name="expertId" required>
            {experts.map((expert) => <option value={expert.id} key={expert.id}>{expert.displayName}</option>)}
          </select>
          <div className="checkbox-list">
            {services.map((service) => (
              <label key={service.id}>
                <input name="serviceIds" type="checkbox" value={service.id} />
                <span>{service.name}</span>
              </label>
            ))}
          </div>
          <button type="submit">Save assignments</button>
        </form>
        <form className="admin-form" onSubmit={uploadExpertPhoto}>
          <h2>Expert photo</h2>
          <select name="expertId" required>
            {experts.map((expert) => <option value={expert.id} key={expert.id}>{expert.displayName}</option>)}
          </select>
          <input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required />
          <button type="submit">Upload photo</button>
        </form>
      </section>
      <section className="admin-grid-two">
        <form className="admin-form" onSubmit={addAvailability}>
          <h2>Add availability</h2>
          <select name="expertId" required>
            {experts.map((expert) => <option value={expert.id} key={expert.id}>{expert.displayName}</option>)}
          </select>
          <select name="dayOfWeek" required>
            <option value="1">Monday</option>
            <option value="2">Tuesday</option>
            <option value="3">Wednesday</option>
            <option value="4">Thursday</option>
            <option value="5">Friday</option>
            <option value="6">Saturday</option>
            <option value="0">Sunday</option>
          </select>
          <input name="startLocalTime" placeholder="10:00" pattern="^([01]\\d|2[0-3]):[0-5]\\d$" required />
          <input name="endLocalTime" placeholder="18:00" pattern="^([01]\\d|2[0-3]):[0-5]\\d$" required />
          <button type="submit">Create rule</button>
        </form>
        <form className="admin-form" onSubmit={addException}>
          <h2>Add exception</h2>
          <select name="expertId" required>
            {experts.map((expert) => <option value={expert.id} key={expert.id}>{expert.displayName}</option>)}
          </select>
          <select name="type" required>
            <option value="block">Block</option>
            <option value="override">Override</option>
          </select>
          <input name="startsOn" type="date" required />
          <input name="endsOn" type="date" required />
          <input name="startLocalTime" placeholder="10:00 optional" pattern="^([01]\\d|2[0-3]):[0-5]\\d$" />
          <input name="endLocalTime" placeholder="14:00 optional" pattern="^([01]\\d|2[0-3]):[0-5]\\d$" />
          <textarea name="reason" placeholder="Reason optional" />
          <button type="submit">Create exception</button>
        </form>
      </section>
      <section className="admin-grid-two">
        <div>
          <h2>Services</h2>
          <div className="edit-list">
            {services.map((service) => (
              <form className="admin-form compact-edit-form" onSubmit={(event) => updateService(event, service.id)} key={service.id}>
                <input name="name" defaultValue={service.name} required />
                <input name="durationMinutes" type="number" defaultValue={service.durationMinutes} required />
                <input name="displayPriceAmount" type="number" placeholder="Price" defaultValue={service.displayPriceAmount ?? ''} />
                <label className="check-row">
                  <input name="isActive" type="checkbox" defaultChecked={service.isActive} />
                  <span>Active</span>
                </label>
                <label className="check-row">
                  <input name="isPublic" type="checkbox" defaultChecked={service.isPublic} />
                  <span>Public</span>
                </label>
                <button type="submit">Save</button>
              </form>
            ))}
          </div>
        </div>
        <div>
          <h2>Experts</h2>
          <div className="edit-list">
            {experts.map((expert) => (
              <form className="admin-form compact-edit-form" onSubmit={(event) => updateExpert(event, expert.id)} key={expert.id}>
                <input name="displayName" defaultValue={expert.displayName} required />
                <input name="shortBio" placeholder="Short bio" defaultValue={expert.shortBio ?? ''} />
                <label className="check-row">
                  <input name="isActive" type="checkbox" defaultChecked={expert.isActive} />
                  <span>Active</span>
                </label>
                <button type="submit">Save</button>
              </form>
            ))}
          </div>
        </div>
      </section>
      <section className="admin-grid-two">
        <div>
          <div className="section-title-row">
            <h2>Availability rules</h2>
            <select value={availabilityExpertId} onChange={(event) => setAvailabilityExpertId(event.target.value)}>
              {experts.map((expert) => <option value={expert.id} key={expert.id}>{expert.displayName}</option>)}
            </select>
          </div>
          <div className="admin-table">
            {rules.map((rule) => (
              <div className="admin-row compact-admin-row" key={rule.id}>
                <span>{days[rule.dayOfWeek]}<small>{rule.startLocalTime} to {rule.endLocalTime}</small></span>
                <button type="button" className="text-action" onClick={() => archiveAvailabilityRule(rule.id)}>Archive</button>
              </div>
            ))}
            {rules.length === 0 && <div className="admin-row compact-admin-row"><span>No rules yet</span></div>}
          </div>
        </div>
        <div>
          <h2>Exceptions</h2>
          <div className="admin-table">
            {exceptions.map((exception) => (
              <div className="admin-row compact-admin-row" key={exception.id}>
                <span>
                  {exception.type}
                  <small>
                    {exception.startsOn.slice(0, 10)} to {exception.endsOn.slice(0, 10)}
                    {exception.startLocalTime ? `, ${exception.startLocalTime} to ${exception.endLocalTime}` : ''}
                  </small>
                </span>
                <button type="button" className="text-action" onClick={() => deleteException(exception.id)}>Delete</button>
              </div>
            ))}
            {exceptions.length === 0 && <div className="admin-row compact-admin-row"><span>No exceptions yet</span></div>}
          </div>
        </div>
      </section>
      <section>
        <div className="admin-heading">
          <div>
            <h2>Bookings</h2>
            <p>{bookingLoading ? 'Loading bookings...' : `${bookings.total} total matching bookings`}</p>
          </div>
        </div>
        <form className="admin-form-row booking-filter" onSubmit={filterBookings}>
          <input name="search" placeholder="Reference, customer, phone, email" />
          <select name="status" defaultValue="">
            <option value="">Any status</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
            <option value="no_show">No-show</option>
          </select>
          <select name="serviceId" defaultValue="">
            <option value="">Any service</option>
            {services.map((service) => <option value={service.id} key={service.id}>{service.name}</option>)}
          </select>
          <select name="expertId" defaultValue="">
            <option value="">Any expert</option>
            {experts.map((expert) => <option value={expert.id} key={expert.id}>{expert.displayName}</option>)}
          </select>
          <button type="submit">Filter</button>
        </form>
        {selectedBooking && (
          <section className="detail-panel">
            <div className="section-title-row">
              <h2>{selectedBooking.bookingReference}</h2>
              <button type="button" className="text-action" onClick={() => setSelectedBooking(null)}>Close</button>
            </div>
            <dl className="detail-grid">
              <div><dt>Customer</dt><dd>{selectedBooking.customerNameSnapshot}</dd></div>
              <div><dt>Phone</dt><dd>{selectedBooking.customerPhoneSnapshot ?? 'Not stored'}</dd></div>
              <div><dt>Email</dt><dd>{selectedBooking.customerEmailSnapshot ?? 'Not provided'}</dd></div>
              <div><dt>Service</dt><dd>{selectedBooking.service.name}</dd></div>
              <div><dt>Expert</dt><dd>{selectedBooking.expert.displayName}</dd></div>
              <div><dt>Time</dt><dd>{selectedBooking.displayTimeSnapshot ?? displayDate(selectedBooking.startsAt)}</dd></div>
              <div><dt>Location</dt><dd>{selectedBooking.locationAddressSnapshot ?? `${selectedBooking.location.name}, ${selectedBooking.location.locality}`}</dd></div>
              <div><dt>Status</dt><dd><span className={`badge ${selectedBooking.status}`}>{selectedBooking.status}</span></dd></div>
              <div><dt>Note</dt><dd>{selectedBooking.customerNote ?? 'None'}</dd></div>
            </dl>
          </section>
        )}
        <div className="admin-table">
          <div className="admin-row booking-row admin-row-head">
            <span>Booking</span>
            <span>Customer</span>
            <span>When</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {bookings.items.map((booking) => (
            <div className="admin-row booking-row" key={booking.id}>
              <span>{booking.bookingReference}<small>{booking.service.name} with {booking.expert.displayName}</small></span>
              <span>{booking.customerNameSnapshot}<small>{booking.customerPhoneSnapshot}</small></span>
              <span>{displayDate(booking.startsAt)}<small>{booking.location.name}, {booking.location.locality}</small></span>
              <span className={`badge ${booking.status}`}>{booking.status}</span>
              <span className="admin-actions">
                <button type="button" onClick={() => viewBooking(booking.id)}>View</button>
                {booking.status === 'confirmed' && (
                  <>
                    <button type="button" onClick={() => transitionBooking(booking.id, 'complete')}>Complete</button>
                    <button type="button" onClick={() => transitionBooking(booking.id, 'no-show')}>No-show</button>
                    <button type="button" onClick={() => transitionBooking(booking.id, 'cancel')}>Cancel</button>
                  </>
                )}
              </span>
            </div>
          ))}
          {bookings.items.length === 0 && <div className="admin-row booking-row"><span>No bookings found</span></div>}
        </div>
        <div className="pagination-row">
          <button type="button" onClick={() => changeBookingPage(-1)} disabled={bookings.skip === 0 || bookingLoading}>Previous</button>
          <span>{bookings.total === 0 ? '0-0' : `${bookings.skip + 1}-${Math.min(bookings.skip + bookings.items.length, bookings.total)}`} of {bookings.total}</span>
          <button type="button" onClick={() => changeBookingPage(1)} disabled={bookings.skip + bookings.take >= bookings.total || bookingLoading}>Next</button>
        </div>
      </section>
    </>
  );
}
