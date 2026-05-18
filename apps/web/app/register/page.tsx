import { Suspense } from 'react';
import { PublicHeader } from '../components/PublicHeader';
import { RegisterClient } from './RegisterClient';

export default function RegisterPage() {
  return (
    <main className="page-shell">
      <PublicHeader />
      <section className="auth-page">
        <div>
          <p className="eyebrow">Customer registration</p>
          <h1>Create your account</h1>
          <p>Register with an email address, mobile number, or both.</p>
        </div>
        <Suspense fallback={null}>
          <RegisterClient />
        </Suspense>
      </section>
    </main>
  );
}
