'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiPost, CustomerAuthResponse } from '../lib/api';
import { Notice } from '../components/ui';

export function RegisterClient() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params?.get('returnTo') || '/';
  const [status, setStatus] = useState('');

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus('Creating account...');
    try {
      await apiPost<CustomerAuthResponse>('/api/public/auth/register', {
        name: form.get('name'),
        email: form.get('email') || undefined,
        mobileNumber: form.get('mobileNumber') || undefined,
        password: form.get('password'),
        trustDevice: form.get('trustDevice') === 'on',
      });
      router.push(returnTo);
    } catch {
      setStatus('Registration failed. Use a unique email/mobile number and a valid password.');
    }
  }

  return (
    <form className="auth-card single" onSubmit={register}>
      <input name="name" placeholder="Full name" required minLength={2} />
      <input name="email" placeholder="Email optional" type="email" />
      <input name="mobileNumber" placeholder="+919876543210 optional" pattern="^\+[1-9]\d{7,14}$" />
      <input name="password" placeholder="Password, minimum 8 characters" type="password" required minLength={8} />
      <label className="check-row">
        <input name="trustDevice" type="checkbox" defaultChecked />
        <span>Trust this device</span>
      </label>
      <button type="submit">Create account</button>
      <a href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>Already registered?</a>
      {status && <Notice>{status}</Notice>}
    </form>
  );
}
