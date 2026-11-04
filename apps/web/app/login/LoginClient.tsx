'use client';

import { Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiPost, CustomerAuthResponse } from '../lib/api';
import { Note } from '../components/neara/primitives';

export function LoginClient() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params?.get('returnTo') || '/';
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setStatus('');
    try {
      await apiPost<CustomerAuthResponse>('/api/public/auth/login', {
        identifier: form.get('identifier'),
        password: form.get('password'),
        trustDevice: form.get('trustDevice') === 'on',
      });
      router.push(returnTo);
    } catch {
      setStatus('Those details did not match an account. Check your password and try again.');
      setBusy(false);
    }
  }

  async function requestOtp() {
    if (!identifier.includes('@')) {
      setStatus('One-time codes are sent by email. Enter the email address on your account first.');
      return;
    }
    setOtpBusy(true);
    setStatus('');
    try {
      await apiPost('/api/public/auth/otp/request', {
        identifier,
        purpose: 'login',
        channel: 'email',
      });
      setOtpRequested(true);
      setStatus('If that email has an account, a six-digit code is on its way.');
    } catch {
      setStatus('We could not send a code right now. Try again shortly.');
    } finally {
      setOtpBusy(false);
    }
  }

  async function confirmOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setOtpBusy(true);
    setStatus('');
    try {
      await apiPost<CustomerAuthResponse>('/api/public/auth/otp/confirm', {
        identifier,
        otp: form.get('otp'),
        purpose: 'login',
        trustDevice: true,
      });
      router.push(returnTo);
    } catch {
      setStatus('That code is invalid or has expired. Request a new one.');
      setOtpBusy(false);
    }
  }

  return (
    <main className="n-main">
      <div className="n-auth">
        <nav className="n-seg" aria-label="Account access">
          <a href={`/login?returnTo=${encodeURIComponent(returnTo)}`} aria-current="page">
            Sign in
          </a>
          <a href={`/register?returnTo=${encodeURIComponent(returnTo)}`}>Register</a>
        </nav>

        <div className="n-auth-head">
          <p className="n-eyebrow">Account access</p>
          <h1 className="n-display">Welcome back</h1>
          <p className="n-body">Sign in to hold a slot and keep your appointment details in one place.</p>
        </div>

        <div className="n-auth-card">
          <form className="n-auth-form" onSubmit={login}>
            <label className="n-field">
              <span className="n-field-label">Email or mobile number</span>
              <span className="n-input-wrap">
                <Mail className="n-input-icon" aria-hidden="true" size={18} />
                <input
                  className="n-input"
                  name="identifier"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="username"
                  required
                />
              </span>
            </label>

            <label className="n-field">
              <span className="n-field-label">Password</span>
              <span className="n-input-wrap">
                <LockKeyhole className="n-input-icon" aria-hidden="true" size={18} />
                <input
                  className="n-input n-input-has-action"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Your password"
                  autoComplete="current-password"
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

            <div className="n-auth-meta">
              <label className="n-check">
                <input name="trustDevice" type="checkbox" defaultChecked />
                <span>Trust this device</span>
              </label>
              <a className="n-link n-link-quiet" href={`/forgot-password?returnTo=${encodeURIComponent(returnTo)}`}>
                Forgot password?
              </a>
            </div>

            <button type="submit" className="n-btn n-btn-block" disabled={busy}>
              {busy ? <LoaderCircle aria-hidden="true" size={17} /> : null}
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="n-divider">or</div>

          {otpRequested ? (
            <form className="n-auth-form" onSubmit={confirmOtp}>
              <p className="n-meta">
                Enter the six-digit code sent to <strong className="n-ink">{identifier}</strong>.
              </p>
              <label className="n-field">
                <span className="n-field-label">One-time code</span>
                <span className="n-input-wrap">
                  <KeyRound className="n-input-icon" aria-hidden="true" size={18} />
                  <input
                    className="n-input"
                    name="otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="\d{6}"
                    maxLength={6}
                    placeholder="123456"
                    required
                  />
                </span>
              </label>
              <div className="n-gate-actions">
                <button type="submit" className="n-btn n-btn-secondary n-btn-sm" disabled={otpBusy}>
                  {otpBusy ? 'Checking…' : 'Verify code'}
                </button>
                <button
                  type="button"
                  className="n-btn n-btn-quiet n-btn-sm"
                  onClick={() => {
                    setOtpRequested(false);
                    setStatus('');
                  }}
                >
                  Use password
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              className="n-btn n-btn-secondary n-btn-block"
              onClick={requestOtp}
              disabled={otpBusy}
            >
              <Mail aria-hidden="true" size={17} />
              {otpBusy ? 'Sending code…' : 'Email me a sign-in code'}
            </button>
          )}
        </div>

        <p className="n-auth-alt">
          New to Neara? <a className="n-link" href={`/register?returnTo=${encodeURIComponent(returnTo)}`}>Create an account</a>
        </p>

        {status ? (
          <Note tone={status.includes('did not match') || status.includes('invalid') || status.includes('could not') ? 'error' : 'neutral'}>
            {status}
          </Note>
        ) : null}

        <p className="n-auth-assurance">
          <ShieldCheck aria-hidden="true" size={16} />
          <span>
            Neara never stores card details. We use your contact details only to confirm appointments and
            keep you updated about them.
          </span>
        </p>
      </div>
    </main>
  );
}
