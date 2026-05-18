import { Suspense } from 'react';
import { PublicHeader } from '../components/PublicHeader';
import { ForgotPasswordClient } from './ForgotPasswordClient';

export default function ForgotPasswordPage() {
  return (
    <main className="page-shell">
      <PublicHeader />
      <section className="auth-page">
        <div>
          <p className="eyebrow">Password reset</p>
          <h1>Reset password</h1>
          <p>Email OTP reset is available for customer accounts with an email address.</p>
        </div>
        <Suspense fallback={null}>
          <ForgotPasswordClient />
        </Suspense>
      </section>
    </main>
  );
}
