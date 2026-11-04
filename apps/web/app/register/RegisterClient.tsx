'use client';

import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiPost, CustomerAuthResponse } from '../lib/api';
import { Note } from '../components/neara/primitives';

export function RegisterClient() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params?.get('returnTo') || '/';
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const mobileNumber = String(form.get('mobileNumber') ?? '').trim();
    if (!email && !mobileNumber) {
      setStatus('Add an email address or a mobile number so the studio can reach you.');
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      await apiPost<CustomerAuthResponse>('/api/public/auth/register', {
        name: form.get('name'),
        email: email || undefined,
        mobileNumber: mobileNumber || undefined,
        password: form.get('password'),
        trustDevice: form.get('trustDevice') === 'on',
      });
      router.push(returnTo);
    } catch {
      setStatus('We could not create the account. Use a unique email or mobile number and a password of at least 8 characters.');
      setBusy(false);
    }
  }

  return (
    <main className="n-main">
      <div className="n-auth">
        <nav className="n-seg" aria-label="Account access">
          <a href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>Sign in</a>
          <a href={`/register?returnTo=${encodeURIComponent(returnTo)}`} aria-current="page">
            Register
          </a>
        </nav>

        <div className="n-auth-head">
          <p className="n-eyebrow">Account access</p>
          <h1 className="n-display">Create your account</h1>
          <p className="n-body">One account for every studio you book with. It takes less than a minute.</p>
        </div>

        <div className="n-auth-card">
          <form className="n-auth-form" onSubmit={register}>
            <label className="n-field">
              <span className="n-field-label">Full name</span>
              <span className="n-input-wrap">
                <UserRound className="n-input-icon" aria-hidden="true" size={18} />
                <input
                  className="n-input"
                  name="name"
                  placeholder="Asha Menon"
                  autoComplete="name"
                  minLength={2}
                  required
                />
              </span>
            </label>

            <label className="n-field">
              <span className="n-field-label">Email</span>
              <span className="n-input-wrap">
                <Mail className="n-input-icon" aria-hidden="true" size={18} />
                <input
                  className="n-input"
                  name="email"
                  type="email"
                  placeholder="you@example.com (optional)"
                  autoComplete="email"
                />
              </span>
            </label>

            <label className="n-field">
              <span className="n-field-label">Mobile number</span>
              <span className="n-input-wrap">
                <Phone className="n-input-icon" aria-hidden="true" size={18} />
                <input
                  className="n-input"
                  name="mobileNumber"
                  type="tel"
                  placeholder="+919876543210 (optional)"
                  pattern="^\+[1-9]\d{7,14}$"
                  autoComplete="tel"
                />
              </span>
              <span className="n-hint">Include the country code, e.g. +919876543210.</span>
            </label>

            <label className="n-field">
              <span className="n-field-label">Password</span>
              <span className="n-input-wrap">
                <LockKeyhole className="n-input-icon" aria-hidden="true" size={18} />
                <input
                  className="n-input n-input-has-action"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  className="n-pass-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
                </button>
              </span>
            </label>

            <label className="n-check">
              <input name="trustDevice" type="checkbox" defaultChecked />
              <span>Trust this device so I can stay signed in</span>
            </label>

            <button type="submit" className="n-btn n-btn-block" disabled={busy}>
              {busy ? <LoaderCircle aria-hidden="true" size={17} /> : null}
              {busy ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="n-auth-alt">
            Already registered?{' '}
            <a className="n-link" href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>
              Sign in
            </a>
          </p>
        </div>

        {status ? <Note tone="error">{status}</Note> : null}

        <p className="n-auth-assurance">
          <ShieldCheck aria-hidden="true" size={16} />
          <span>
            We ask for a name, one contact channel and a password. Nothing else is needed to book, and you can
            delete your account at any time.
          </span>
        </p>
      </div>
    </main>
  );
}
