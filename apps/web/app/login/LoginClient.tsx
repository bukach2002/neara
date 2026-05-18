'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye } from 'lucide-react';
import { apiPost, CustomerAuthResponse } from '../lib/api';
import { Notice } from '../components/ui';

export function LoginClient() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params?.get('returnTo') || '/';
  const [status, setStatus] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus('Logging in...');
    try {
      await apiPost<CustomerAuthResponse>('/api/public/auth/login', {
        identifier: form.get('identifier'),
        password: form.get('password'),
        trustDevice: true,
      });
      router.push(returnTo);
    } catch {
      setStatus('Login failed. Check your details and try again.');
    }
  }

  async function requestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextIdentifier = String(form.get('identifier') ?? '');
    setIdentifier(nextIdentifier);
    setStatus('Sending OTP...');
    try {
      await apiPost('/api/public/auth/otp/request', {
        identifier: nextIdentifier,
        purpose: 'login',
        channel: 'email',
      });
      setOtpRequested(true);
      setStatus('If an email account exists, an OTP has been sent.');
    } catch {
      setStatus('Could not request OTP. Try again shortly.');
    }
  }

  async function confirmOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus('Checking OTP...');
    try {
      await apiPost<CustomerAuthResponse>('/api/public/auth/otp/confirm', {
        identifier,
        otp: form.get('otp'),
        purpose: 'login',
        trustDevice: true,
      });
      router.push(returnTo);
    } catch {
      setStatus('OTP is invalid or expired.');
    }
  }

  return (
    <div className="auth-stack">
      <div className="auth-card">
        <form className="auth-form" onSubmit={login}>
          <label>
            <input name="identifier" placeholder="Email or Mobile number" required aria-label="Email or Mobile Number" />
          </label>
          <label>
            <span className="input-action-field">
              <input name="password" placeholder="Password" type={showPassword ? 'text' : 'password'} required minLength={8} aria-label="Password" />
              <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                <Eye size={22} aria-hidden="true" />
              </button>
            </span>
          </label>
          <p className="auth-meta-row auth-meta-end">
            <a href={`/forgot-password?returnTo=${encodeURIComponent(returnTo)}`}>Forgot Password?</a>
          </p>
          <button type="submit">
            SIGN IN
          </button>
        </form>

        <div className="auth-divider">
          <span />
          <p>OR CONTINUE WITH</p>
          <span />
        </div>

        <div className="auth-provider-grid">
          <button type="button">
            <span className="provider-mark google-mark">G</span>
            Google
          </button>
          <form onSubmit={otpRequested ? confirmOtp : requestOtp} title="Email OTP is used until Apple sign-in is configured">
            {!otpRequested ? (
              <>
                <input className="sr-only-field" name="identifier" placeholder="Email or Mobile number" type="email" required aria-label="Email or Mobile number for OTP" />
                <button type="submit">
                  <span className="provider-mark apple-mark">iOS</span>
                  Apple
                </button>
              </>
            ) : (
              <>
                <input className="sr-only-field" value={identifier} readOnly aria-label="Email address" />
                <input className="sr-only-field" name="otp" placeholder="6-digit OTP" required pattern="\\d{6}" aria-label="6-digit OTP" />
                <button type="submit">
                  <span className="provider-mark apple-mark">iOS</span>
                  Verify OTP
                </button>
              </>
            )}
          </form>
        </div>
      </div>

      <p className="auth-switch-copy">
        Don&apos;t have an account? <a href={`/register?returnTo=${encodeURIComponent(returnTo)}`}>Create an Account</a>
      </p>
      {status && <Notice>{status}</Notice>}
    </div>
  );
}
