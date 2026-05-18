'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiPost } from '../lib/api';
import { Notice } from '../components/ui';

export function ForgotPasswordClient() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params?.get('returnTo') || '/login';
  const [identifier, setIdentifier] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [status, setStatus] = useState('');

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextIdentifier = String(form.get('identifier') ?? '');
    setIdentifier(nextIdentifier);
    setStatus('Sending reset OTP...');
    try {
      await apiPost('/api/public/auth/password-reset/request', {
        identifier: nextIdentifier,
        purpose: 'password_reset',
        channel: 'email',
      });
      setOtpSent(true);
      setStatus('If an email account exists, a reset OTP has been sent.');
    } catch {
      setStatus('Could not request reset OTP. Try again shortly.');
    }
  }

  async function confirmReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus('Resetting password...');
    try {
      await apiPost('/api/public/auth/password-reset/confirm', {
        identifier,
        otp: form.get('otp'),
        newPassword: form.get('newPassword'),
      });
      router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    } catch {
      setStatus('OTP is invalid or expired.');
    }
  }

  return (
    <form className="auth-card single" onSubmit={otpSent ? confirmReset : requestReset}>
      {!otpSent ? (
        <input name="identifier" placeholder="Email address" type="email" required />
      ) : (
        <>
          <input value={identifier} readOnly />
          <input name="otp" placeholder="6-digit OTP" required pattern="\\d{6}" />
          <input name="newPassword" placeholder="New password" type="password" required minLength={8} />
        </>
      )}
      <button type="submit">{otpSent ? 'Reset password' : 'Send reset OTP'}</button>
      {status && <Notice>{status}</Notice>}
    </form>
  );
}
