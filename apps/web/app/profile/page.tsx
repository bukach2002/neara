import { PublicHeader } from '../components/PublicHeader';
import { ProfileClient } from './ProfileClient';

export default function ProfilePage() {
  return (
    <main className="page-shell">
      <PublicHeader />
      <section className="page-heading">
        <p className="eyebrow">Profile</p>
        <h1>Your account</h1>
        <p>View the customer details linked to your Neara bookings.</p>
      </section>
      <ProfileClient />
    </main>
  );
}
