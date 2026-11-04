'use client';

import { Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiPost } from '../lib/api';
import { Note } from '../components/neara/primitives';

export function ForgotPasswordClient() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params?.get('returnTo') || '/login';
  const [identifier, setIdentifier] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [status, setStatus] = useState('');
  const [tone, setTone] = useState<'neutral' | 'error'>('neutral');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextIdentifier = String(form.get('identifier') ?? '').trim();
    setIdentifier(nextIdentifier);
    setBusy(true);
    setTone('neutral');
    setStatus('Sending your reset code…');
    try {
      await apiPost('/api/public/auth/password-reset/request', {
        identifier: nextIdentifier,
        purpose: 'password_reset',
        channel: 'email',
      });
      setOtpSent(true);
      setStatus('If that email has an account, a six-digit reset code has been sent.');
    } catch {
      setTone('error');
      setStatus('We could not send the code. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setTone('neutral');
    setStatus('Resetting your password…');
    try {
      await apiPost('/api/public/auth/password-reset/confirm', {
        identifier,
        otp: form.get('otp'),
        newPassword: form.get('newPassword'),
      });
      router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    } catch {
      setTone('error');
      setStatus('That code is invalid or has expired. Request a new one.');
      setBusy(false);
    }
  }

  return (
    <main className="n-main">
      <div className="n-auth">
        <div className="n-auth-head">
          <p className="n-eyebrow">Password reset</p>
          <h1 className="n-display">Get back in</h1>
          <p className="n-body">
            Reset codes are sent to the email address on your account. Six digits, one use, ten minutes.
          </p>
        </div>

        <div className="n-auth-card">
          {otpSent ? (
            <form className="n-auth-form" onSubmit={confirmReset}>
              <p className="n-meta">
                Code sent to <strong className="n-ink">{identifier}</strong>. Enter it below with a new
                password.
              </p>

              <label className="n-field">
                <span className="n-field-label">Six-digit code</span>
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

              <label className="n-field">
                <span className="n-field-label">New password</span>
                <span className="n-input-wrap">
                  <LockKeyhole className="n-input-icon" aria-hidden="true" size={18} />
                  <input
                    className="n-input n-input-has-action"
                    name="newPassword"
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

              <button type="submit" className="n-btn n-btn-block" disabled={busy}>
                {busy ? <LoaderCircle aria-hidden="true" size={17} /> : null}
                {busy ? 'Resetting…' : 'Reset password'}
              </button>
              <button
                type="button"
                className="n-btn n-btn-quiet n-btn-block"
                onClick={() => {
                  setOtpSent(false);
                  setStatus('');
                }}
              >
                Use a different email
              </button>
            </form>
          ) : (
            <form className="n-auth-form" onSubmit={requestReset}>
              <label className="n-field">
                <span className="n-field-label">Email address</span>
                <span className="n-input-wrap">
                  <Mail className="n-input-icon" aria-hidden="true" size={18} />
                  <input
                    className="n-input"
                    name="identifier"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </span>
              </label>
              <button type="submit" className="n-btn n-btn-block" disabled={busy}>
                {busy ? <LoaderCircle aria-hidden="true" size={17} /> : null}
                {busy ? 'Sending…' : 'Send reset code'}
              </button>
            </form>
          )}
        </div>

        {status ? <Note tone={tone}>{status}</Note> : null}

        <p className="n-auth-alt">
          Remembered it?{' '}
          <a className="n-link" href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>
            Back to sign in
          </a>
        </p>

        <p className="n-auth-assurance">
          <ShieldCheck aria-hidden="true" size={16} />
          <span>
            If the email is not on file, no code is sent and nothing changes. One-time codes are never shown
            on screen or shared with studios.
          </span>
        </p>
      </div>
    </main>
  );
}
