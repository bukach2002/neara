import { Suspense } from 'react';
import { PublicHeader } from '../components/PublicHeader';
import { LoginClient } from './LoginClient';

export default function LoginPage() {
  return (
    <main className="page-shell auth-shell">
      <PublicHeader />
      <section className="auth-page home-hero-focused">
        <div className="auth-heading">
          <h1>Welcome Back</h1>
          <p>Please enter your details to sign in and manage your bookings.</p>
        </div>
        <Suspense fallback={null}>
          <LoginClient />
        </Suspense>
      </section>
    </main>
  );
}
