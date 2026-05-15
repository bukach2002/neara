import { PublicHeader } from '../components/PublicHeader';
import { BookingLookupClient } from './BookingLookupClient';

export default function BookingLookupPage() {
  return (
    <main className="page-shell">
      <PublicHeader />
      <section className="page-heading">
        <p className="eyebrow">Bookings</p>
        <h1>Find your booking</h1>
        <p>Use your booking reference and phone number to view appointment details.</p>
      </section>
      <BookingLookupClient />
    </main>
  );
}
